import { resolveMedia } from './extractor.js';

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
    progress: 0,
    result: null,
    error: null
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
    job.progress = 25;

    await new Promise(res => setTimeout(res, 300));
    job.progress = 60;

    const metadata = await resolveMedia(job.sourceUrl);
    job.progress = 100;
    job.status = 'completed';
    
    job.result = { ...metadata, _sourceUrl: job.sourceUrl };
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Failed to extract media metadata.';
  }
}

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

export function createAudioJob(jobId, format, quality) {
  const parentJob = jobs.get(jobId);
  if (!parentJob || parentJob.status !== 'completed') {
    throw new Error('Parent job not found or incomplete');
  }

  const audioJobId = 'audio_' + generateJobId();
  const audioJob = {
    id: audioJobId,
    parentJobId: jobId,
    format: format || 'MP3',
    quality: quality || '320 kbps',
    status: 'completed',
    downloadUrl: `/api/v1/download/${audioJobId}?type=audio&format=${encodeURIComponent(format)}&quality=${encodeURIComponent(quality)}`,
    createdAt: new Date().toISOString()
  };

  jobs.set(audioJobId, audioJob);
  return audioJob;
}
