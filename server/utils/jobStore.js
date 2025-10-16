const jobs = new Map();

export function createJob(jobData) {
  jobs.set(jobData.id, jobData);
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
