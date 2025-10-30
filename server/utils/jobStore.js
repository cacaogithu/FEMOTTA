import { db } from '../db.js';
import { jobs as jobsTable } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const jobs = new Map();
const feedbackData = new Map();

// Save job to database
async function saveJobToDb(jobId, jobData) {
  try {
    const dbJob = {
      jobId,
      brandId: jobData.brandId || 1,
      status: jobData.status || 'pending',
      briefText: jobData.briefText !== undefined ? jobData.briefText : null,
      briefFileId: jobData.briefFileId !== undefined ? jobData.briefFileId : null,
      promptText: jobData.promptText !== undefined ? jobData.promptText : null,
      processingStep: jobData.processingStep !== undefined ? jobData.processingStep : null,
      imageSpecs: jobData.imageSpecs !== undefined ? jobData.imageSpecs : null,
      workflowSteps: jobData.workflowSteps !== undefined ? jobData.workflowSteps : [],
      imagesData: jobData.images !== undefined ? jobData.images : [],
      editedImagesData: jobData.editedImages !== undefined ? jobData.editedImages : [],
      imageProgress: jobData.imageProgress !== undefined ? jobData.imageProgress : [],
      startTime: jobData.startTime ? new Date(jobData.startTime) : null,
      endTime: jobData.endTime ? new Date(jobData.endTime) : null,
      processingTimeSeconds: jobData.processingTimeSeconds !== undefined ? jobData.processingTimeSeconds : null,
      estimatedManualTimeMinutes: jobData.estimatedManualTimeMinutes !== undefined ? jobData.estimatedManualTimeMinutes : null
    };

    const updateFields = {};
    if (jobData.status !== undefined) updateFields.status = dbJob.status;
    if (jobData.briefText !== undefined) updateFields.briefText = dbJob.briefText;
    if (jobData.briefFileId !== undefined) updateFields.briefFileId = dbJob.briefFileId;
    if (jobData.promptText !== undefined) updateFields.promptText = dbJob.promptText;
    if (jobData.processingStep !== undefined) updateFields.processingStep = dbJob.processingStep;
    if (jobData.imageSpecs !== undefined) updateFields.imageSpecs = dbJob.imageSpecs;
    if (jobData.workflowSteps !== undefined) updateFields.workflowSteps = dbJob.workflowSteps;
    if (jobData.images !== undefined) updateFields.imagesData = dbJob.imagesData;
    if (jobData.editedImages !== undefined) updateFields.editedImagesData = dbJob.editedImagesData;
    if (jobData.imageProgress !== undefined) updateFields.imageProgress = dbJob.imageProgress;
    if (jobData.startTime !== undefined) updateFields.startTime = dbJob.startTime;
    if (jobData.endTime !== undefined) updateFields.endTime = dbJob.endTime;
    if (jobData.processingTimeSeconds !== undefined) updateFields.processingTimeSeconds = dbJob.processingTimeSeconds;
    if (jobData.estimatedManualTimeMinutes !== undefined) updateFields.estimatedManualTimeMinutes = dbJob.estimatedManualTimeMinutes;

    await db.insert(jobsTable)
      .values(dbJob)
      .onConflictDoUpdate({
        target: jobsTable.jobId,
        set: updateFields
      });
  } catch (error) {
    console.error('[JobStore] Failed to save job to database:', error);
  }
}

export function createJob(jobData) {
  const job = {
    ...jobData,
    workflowSteps: [],
    imageProgress: []
  };
  jobs.set(jobData.id, job);
  // Save to database asynchronously
  saveJobToDb(jobData.id, job).catch(err => console.error('[JobStore] Create job DB error:', err));
  return job;
}

export async function getJobWithFallback(jobId) {
  // Try memory first
  let job = jobs.get(jobId);
  if (job) {
    return job;
  }
  
  // Fallback to database
  console.log(`[JobStore] Job ${jobId} not in memory, loading from database...`);
  job = await loadJobFromDb(jobId);
  return job;
}

export function getJob(jobId) {
  return jobs.get(jobId);
}

export async function loadJobFromDb(jobId) {
  try {
    const result = await db.select().from(jobsTable).where(eq(jobsTable.jobId, jobId)).limit(1);
    if (result && result.length > 0) {
      const dbJob = result[0];
      const job = {
        id: dbJob.jobId,
        brandId: dbJob.brandId,
        status: dbJob.status,
        briefText: dbJob.briefText,
        briefFileId: dbJob.briefFileId,
        promptText: dbJob.promptText,
        processingStep: dbJob.processingStep,
        imageSpecs: dbJob.imageSpecs,
        workflowSteps: dbJob.workflowSteps || [],
        images: dbJob.imagesData || [],
        editedImages: dbJob.editedImagesData || [],
        imageProgress: dbJob.imageProgress || [],
        startTime: dbJob.startTime,
        endTime: dbJob.endTime,
        processingTimeSeconds: dbJob.processingTimeSeconds,
        estimatedManualTimeMinutes: dbJob.estimatedManualTimeMinutes
      };
      // Load into memory
      jobs.set(jobId, job);
      return job;
    }
  } catch (error) {
    console.error('[JobStore] Failed to load job from database:', error);
  }
  return null;
}

export function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (job) {
    const updatedJob = { ...job, ...updates };
    jobs.set(jobId, updatedJob);
    // Save to database asynchronously
    saveJobToDb(jobId, updatedJob).catch(err => console.error('[JobStore] Update job DB error:', err));
    return updatedJob;
  }
  return null;
}

export function deleteJob(jobId) {
  jobs.delete(jobId);
}

export function addWorkflowStep(jobId, step) {
  const job = jobs.get(jobId);
  if (job) {
    const workflowSteps = job.workflowSteps || [];
    workflowSteps.push({
      ...step,
      timestamp: new Date().toISOString()
    });
    jobs.set(jobId, { ...job, workflowSteps });
  }
}

export function saveFeedback(jobId, feedbackInfo) {
  const key = `${jobId}_${Date.now()}`;
  feedbackData.set(key, {
    ...feedbackInfo,
    timestamp: new Date().toISOString()
  });
  return key;
}

export function getAllFeedback() {
  return Array.from(feedbackData.values());
}

export function getFeedbackForJob(jobId) {
  const allFeedback = Array.from(feedbackData.entries());
  return allFeedback
    .filter(([key]) => key.startsWith(jobId))
    .map(([, value]) => value);
}
