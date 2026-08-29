import express from 'express';
import { createJob, getJob } from '../services/jobQueue.js';

const router = express.Router();

// POST /api/v1/resolve  — start a resolution job
router.post('/resolve', (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!/^https?:\/\//i.test(url.trim())) {
    return res.status(400).json({ error: 'Unsupported link — paste a valid video URL.' });
  }
  const jobId = createJob(url.trim());
  res.json({ jobId, status: 'pending' });
});

// GET /api/v1/jobs/:jobId  — poll job status
router.get('/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

export default router;
