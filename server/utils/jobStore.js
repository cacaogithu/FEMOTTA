const jobs = new Map();
const feedbackData = new Map();

export function createJob(jobData) {
  jobs.set(jobData.id, {
    ...jobData,
    workflowSteps: [],
    imageProgress: []
  });
  return jobData;
}

export function getJob(jobId) {
  return jobs.get(jobId);
}

export function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (job) {
    const updatedJob = { ...job, ...updates };
    jobs.set(jobId, updatedJob);
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
