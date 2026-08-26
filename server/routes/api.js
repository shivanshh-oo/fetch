import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { detectPlatform } from '../services/extractor.js';
import { createJob, getJob, createAudioJob } from '../services/jobQueue.js';

const execAsync = promisify(exec);
const router = express.Router();

router.post('/detect', (req, res) => {
  res.json(detectPlatform((req.body || {}).url));
});

router.post('/resolve', (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const detection = detectPlatform(url);
  if (!detection.supported) return res.status(400).json({ error: detection.error });
  res.json({ jobId: createJob(url), status: 'pending' });
});

router.get('/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

router.post('/jobs/:jobId/audio', (req, res) => {
  const { format, quality } = req.body || {};
  try { res.json(createAudioJob(req.params.jobId, format, quality)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

const FFMPEG_PATH = 'C:\\Users\\Prompt\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin\\ffmpeg.exe';

router.get('/download/file', async (req, res) => {
  const { url, title = 'FETCH_video', audio = '0', height = '0' } = req.query;

  if (!url) return res.status(400).json({ error: 'url query param required' });

  const decodedUrl = decodeURIComponent(url);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fetchly_'));
  const outFile = path.join(tmpDir, 'output.mp4');

  const isAudio = audio === '1';
  const maxHeight = parseInt(height, 10) || 0;

  let cmd;
  if (isAudio) {
    const outAudio = path.join(tmpDir, 'output.mp3');
    cmd = `yt-dlp --ffmpeg-location "${FFMPEG_PATH}" -x --audio-format mp3 --audio-quality 0 --no-playlist --no-warnings -o "${outAudio}" "${decodedUrl}"`;
  } else if (maxHeight > 0) {
    
    cmd = `yt-dlp --ffmpeg-location "${FFMPEG_PATH}" -f "bestvideo[height<=${maxHeight}]+bestaudio/bv*[height<=${maxHeight}]+ba/best" --merge-output-format mp4 --no-playlist --no-warnings -o "${outFile}" "${decodedUrl}"`;
  } else {
    
    cmd = `yt-dlp --ffmpeg-location "${FFMPEG_PATH}" -f "bestvideo+bestaudio/bv*+ba/best" --merge-output-format mp4 --no-playlist --no-warnings -o "${outFile}" "${decodedUrl}"`;
  }

  try {
    console.log(`[Download] Running yt-dlp for ${isAudio ? 'audio' : 'video'}...`);
    const { stderr } = await execAsync(cmd, { timeout: 120000, maxBuffer: 5 * 1024 * 1024 });

    if (stderr) {
      const errs = stderr.split('\n').filter(l => l.includes('ERROR'));
      if (errs.length > 0) console.warn('[Download] yt-dlp stderr:', errs.join('\n'));
    }

    const files = fs.readdirSync(tmpDir);
    if (files.length === 0) throw new Error('yt-dlp produced no output file');

    const outputFile = files
      .map(f => ({ name: f, size: fs.statSync(path.join(tmpDir, f)).size }))
      .filter(f => !f.name.endsWith('.part') && !f.name.endsWith('.ytdl'))
      .sort((a, b) => b.size - a.size)[0];

    if (!outputFile) throw new Error('No valid output file found in temp directory');

    const filePath = path.join(tmpDir, outputFile.name);
    const ext = path.extname(outputFile.name).replace('.', '') || (isAudio ? 'mp3' : 'mp4');
    const safeName = (title || 'FETCH').replace(/[^\w\s-]/g, '').trim().substring(0, 60);
    const dlFilename = `${safeName}.${ext}`;

    console.log(`[Download] Serving: ${dlFilename} (${(outputFile.size / 1048576).toFixed(1)} MB)`);

    res.setHeader('Content-Disposition', `attachment; filename="${dlFilename}"`);
    res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Length', outputFile.size);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('[Download] Stream error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Streaming failed' });
      cleanup(tmpDir);
    });

    res.on('finish', () => cleanup(tmpDir));
    res.on('close', () => cleanup(tmpDir));

  } catch (err) {
    cleanup(tmpDir);
    console.error('[Download] Error:', err.message?.substring(0, 300));
    if (!res.headersSent) {
      res.status(500).json({
        error: err.message?.includes('Private') ? 'This video is private.' :
               err.message?.includes('age') ? 'Age-restricted — sign-in required.' :
               err.message?.includes('not available') ? 'Video not available in this region.' :
               'Download failed. The URL may have expired — try fetching again.'
      });
    }
  }
});

function cleanup(dir) {
  setTimeout(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }, 5000);
}

router.get('/download/:fileId', (req, res) => {
  res.status(410).json({ error: 'Use /api/v1/download/file?url=...&title=...' });
});

export default router;
