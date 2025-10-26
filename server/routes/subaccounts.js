import express from 'express';
import { db } from '../db.js';
import { brands, subaccountUsers, subaccountPrompts, promptVersions, subaccountUsageDaily, jobs, images, editedImages, feedback } from '../../shared/schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { verifyAdminToken } from './admin.js';

const router = express.Router();

router.use(verifyAdminToken);

router.get('/:id/users', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    
    const users = await db
      .select()
      .from(subaccountUsers)
      .where(eq(subaccountUsers.brandId, subaccountId))
      .orderBy(desc(subaccountUsers.createdAt));
    
    const subaccount = await db.select().from(brands).where(eq(brands.id, subaccountId));
    
    res.json({
      users: users.map(u => ({ ...u, passwordHash: undefined })),
      seatsPurchased: subaccount[0]?.seatsPurchased || 1,
      seatsUsed: subaccount[0]?.seatsUsed || 0
    });
  } catch (error) {
    console.error('Error fetching subaccount users:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/users', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    const { email, username, role, password } = req.body;
    
    const subaccount = await db.select().from(brands).where(eq(brands.id, subaccountId));
    if (!subaccount || subaccount.length === 0) {
      return res.status(404).json({ error: 'Subaccount not found' });
    }
    
    if (subaccount[0].seatsUsed >= subaccount[0].seatsPurchased) {
      return res.status(400).json({ error: 'No available seats. Please purchase more seats.' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = await db.insert(subaccountUsers).values({
      brandId: subaccountId,
      email,
      username,
      role: role || 'member',
      passwordHash,
      active: true
    }).returning();
    
    await db.update(brands)
      .set({ seatsUsed: sql`${brands.seatsUsed} + 1` })
      .where(eq(brands.id, subaccountId));
    
    res.json({ ...newUser[0], passwordHash: undefined });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/users/:userId', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    
    await db.delete(subaccountUsers)
      .where(and(
        eq(subaccountUsers.id, userId),
        eq(subaccountUsers.brandId, subaccountId)
      ));
    
    await db.update(brands)
      .set({ seatsUsed: sql`${brands.seatsUsed} - 1` })
      .where(eq(brands.id, subaccountId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/prompts', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    
    const prompts = await db
      .select()
      .from(subaccountPrompts)
      .where(eq(subaccountPrompts.brandId, subaccountId))
      .orderBy(desc(subaccountPrompts.createdAt));
    
    const promptsWithVersions = await Promise.all(prompts.map(async (prompt) => {
      const versions = await db
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.promptId, prompt.id))
        .orderBy(desc(promptVersions.versionNumber));
      
      return { ...prompt, versions };
    }));
    
    res.json(promptsWithVersions);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/prompts', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    const { name, description, category, promptTemplate, aiSettings, createdBy } = req.body;
    
    const newPrompt = await db.insert(subaccountPrompts).values({
      brandId: subaccountId,
      name,
      description,
      category,
      createdBy,
      isDefault: false,
      active: true
    }).returning();
    
    const newVersion = await db.insert(promptVersions).values({
      promptId: newPrompt[0].id,
      versionNumber: 1,
      promptTemplate,
      aiSettings,
      status: 'draft',
      createdBy
    }).returning();
    
    res.json({ prompt: newPrompt[0], version: newVersion[0] });
  } catch (error) {
    console.error('Error creating prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/prompts/:promptId/versions', async (req, res) => {
  try {
    const promptId = parseInt(req.params.promptId);
    const { promptTemplate, aiSettings, createdBy } = req.body;
    
    const existingVersions = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, promptId))
      .orderBy(desc(promptVersions.versionNumber));
    
    const nextVersion = (existingVersions[0]?.versionNumber || 0) + 1;
    
    const newVersion = await db.insert(promptVersions).values({
      promptId,
      versionNumber: nextVersion,
      promptTemplate,
      aiSettings,
      status: 'draft',
      createdBy
    }).returning();
    
    res.json(newVersion[0]);
  } catch (error) {
    console.error('Error creating prompt version:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/prompts/:promptId/activate/:versionId', async (req, res) => {
  try {
    const promptId = parseInt(req.params.promptId);
    const versionId = parseInt(req.params.versionId);
    
    await db.update(promptVersions)
      .set({ status: 'active', activatedAt: new Date() })
      .where(eq(promptVersions.id, versionId));
    
    await db.update(promptVersions)
      .set({ status: 'deprecated' })
      .where(and(
        eq(promptVersions.promptId, promptId),
        sql`${promptVersions.id} != ${versionId}`,
        eq(promptVersions.status, 'active')
      ));
    
    await db.update(subaccountPrompts)
      .set({ activeVersionId: versionId })
      .where(eq(subaccountPrompts.id, promptId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error activating prompt version:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/analytics/usage', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    const { startDate, endDate } = req.query;
    
    let query = db
      .select()
      .from(subaccountUsageDaily)
      .where(eq(subaccountUsageDaily.brandId, subaccountId));
    
    if (startDate) {
      query = query.where(gte(subaccountUsageDaily.date, new Date(startDate)));
    }
    if (endDate) {
      query = query.where(lte(subaccountUsageDaily.date, new Date(endDate)));
    }
    
    const usage = await query.orderBy(desc(subaccountUsageDaily.date));
    
    const totals = usage.reduce((acc, day) => ({
      jobsCreated: acc.jobsCreated + (day.jobsCreated || 0),
      jobsCompleted: acc.jobsCompleted + (day.jobsCompleted || 0),
      imagesProcessed: acc.imagesProcessed + (day.imagesProcessed || 0),
      totalCostCents: acc.totalCostCents + (day.estimatedCostCents || 0),
      totalTimeSavedSeconds: acc.totalTimeSavedSeconds + (day.totalTimeSavedSeconds || 0)
    }), { jobsCreated: 0, jobsCompleted: 0, imagesProcessed: 0, totalCostCents: 0, totalTimeSavedSeconds: 0 });
    
    res.json({ usage, totals });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/analytics/output-quality', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    
    const feedbackData = await db
      .select()
      .from(feedback)
      .where(eq(feedback.brandId, subaccountId))
      .orderBy(desc(feedback.createdAt));
    
    const ratingTrends = feedbackData.reduce((acc, fb) => {
      const date = fb.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { ratings: [], count: 0 };
      }
      acc[date].ratings.push(fb.rating);
      acc[date].count++;
      return acc;
    }, {});
    
    const trends = Object.entries(ratingTrends).map(([date, data]) => ({
      date,
      averageRating: data.ratings.reduce((a, b) => a + b, 0) / data.count,
      count: data.count
    }));
    
    const overallStats = {
      totalFeedback: feedbackData.length,
      averageRating: feedbackData.reduce((sum, fb) => sum + fb.rating, 0) / feedbackData.length || 0,
      averageGoalAlignment: feedbackData.reduce((sum, fb) => sum + (fb.goalAlignment || 0), 0) / feedbackData.length || 0,
      averageCreativity: feedbackData.reduce((sum, fb) => sum + (fb.creativityScore || 0), 0) / feedbackData.length || 0,
      averageTechnicalQuality: feedbackData.reduce((sum, fb) => sum + (fb.technicalQuality || 0), 0) / feedbackData.length || 0
    };
    
    res.json({ trends, stats: overallStats });
  } catch (error) {
    console.error('Error fetching output quality analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/settings', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    
    const subaccount = await db
      .select()
      .from(brands)
      .where(eq(brands.id, subaccountId));
    
    if (!subaccount || subaccount.length === 0) {
      return res.status(404).json({ error: 'Subaccount not found' });
    }
    
    res.json({
      workflowConfig: subaccount[0].workflowConfig,
      seatsPurchased: subaccount[0].seatsPurchased,
      seatsUsed: subaccount[0].seatsUsed,
      monthlyJobLimit: subaccount[0].monthlyJobLimit,
      monthlyImageLimit: subaccount[0].monthlyImageLimit
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/settings', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.id);
    const { workflowConfig, seatsPurchased, monthlyJobLimit, monthlyImageLimit } = req.body;
    
    const updateData = {};
    if (workflowConfig !== undefined) updateData.workflowConfig = workflowConfig;
    if (seatsPurchased !== undefined) updateData.seatsPurchased = seatsPurchased;
    if (monthlyJobLimit !== undefined) updateData.monthlyJobLimit = monthlyJobLimit;
    if (monthlyImageLimit !== undefined) updateData.monthlyImageLimit = monthlyImageLimit;
    
    const updated = await db
      .update(brands)
      .set(updateData)
      .where(eq(brands.id, subaccountId))
      .returning();
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
