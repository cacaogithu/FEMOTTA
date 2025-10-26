import express from 'express';
import MLAnalysisService from '../services/mlAnalysis.js';
import { verifyAdminToken } from './admin.js';
import { db } from '../db.js';
import { brands } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

router.use(verifyAdminToken);

router.post('/analyze/:subaccountId', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.subaccountId);
    const { daysBack, minFeedbackCount } = req.body;

    const subaccount = await db.select().from(brands).where(eq(brands.id, subaccountId));
    if (!subaccount || subaccount.length === 0) {
      return res.status(404).json({ error: 'Subaccount not found' });
    }

    const openaiApiKey = subaccount[0].openaiApiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(400).json({ error: 'OpenAI API key not configured for this subaccount' });
    }

    const mlService = new MLAnalysisService(openaiApiKey);
    const insights = await mlService.generateInsightsSummary(subaccountId, {
      daysBack: daysBack || 30,
      minFeedbackCount: minFeedbackCount || 5
    });

    res.json(insights);
  } catch (error) {
    console.error('ML analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/insights/:subaccountId', async (req, res) => {
  try {
    const subaccountId = parseInt(req.params.subaccountId);

    const subaccount = await db.select().from(brands).where(eq(brands.id, subaccountId));
    if (!subaccount || subaccount.length === 0) {
      return res.status(404).json({ error: 'Subaccount not found' });
    }

    const openaiApiKey = subaccount[0].openaiApiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured',
        needsSetup: true 
      });
    }

    const mlService = new MLAnalysisService(openaiApiKey);
    const promptAnalysis = await mlService.analyzePromptPerformance(subaccountId);

    res.json({
      promptAnalysis,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error fetching ML insights:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/suggest-improvement/:promptId/:versionId', async (req, res) => {
  try {
    const { promptId, versionId } = req.params;
    const { subaccountId } = req.body;

    const subaccount = await db.select().from(brands).where(eq(brands.id, subaccountId));
    if (!subaccount || subaccount.length === 0) {
      return res.status(404).json({ error: 'Subaccount not found' });
    }

    const openaiApiKey = subaccount[0].openaiApiKey || process.env.OPENAI_API_KEY;
    const mlService = new MLAnalysisService(openaiApiKey);

    const promptAnalysis = await mlService.analyzePromptPerformance(subaccountId);
    const targetPrompt = promptAnalysis.find(p => 
      p.promptId === parseInt(promptId) && p.versionId === parseInt(versionId)
    );

    if (!targetPrompt) {
      return res.status(404).json({ error: 'Prompt version not found or insufficient feedback' });
    }

    const suggestion = await mlService.askGPTForImprovement(targetPrompt);

    res.json({
      promptId: targetPrompt.promptId,
      versionId: targetPrompt.versionId,
      currentPerformance: {
        averageRating: targetPrompt.averageRating,
        successRate: targetPrompt.successRate,
        feedbackCount: targetPrompt.feedbackCount
      },
      ...suggestion
    });
  } catch (error) {
    console.error('Error generating suggestion:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
