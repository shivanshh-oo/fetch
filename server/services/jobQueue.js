import { resolveWithRapidApi } from './rapidapi.js';

const jobs = new Map();

function generateJobId() {
  return 'job_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
}

export function createJob(url) {
  const jobId = generateJobId();
  const job = {
    id: jobId,
    sourceUrl: url,
    status: 'pending',
    createdAt: new Date().toISOString(),
    result: null,
    error: null,
  };

  jobs.set(jobId, job);
  processJob(jobId);
  return jobId;
}

async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'processing';

    const metadata = await resolveWithRapidApi(job.sourceUrl);

    job.status = 'completed';
    job.result = { ...metadata, _sourceUrl: job.sourceUrl };
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Failed to extract media metadata.';
    console.error('[jobQueue] Error:', job.error);
  }
}

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}
