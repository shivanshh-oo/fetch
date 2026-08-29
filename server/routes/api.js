import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createJob, getJob } from '../services/jobQueue.js';
import { getCobaltDownloadUrl } from '../services/cobalt.js';

const execAsync = promisify(exec);
const router = express.Router();

// ─── ffmpeg path ────────────────────────────────────────────────────────────
const IS_WINDOWS = os.platform() === 'win32';
const FFMPEG_PATH = IS_WINDOWS
  ? 'C:\\Users\\Prompt\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin\\ffmpeg.exe'
  : 'ffmpeg';

// ─── Routes ─────────────────────────────────────────────────────────────────

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

// ─── YouTube Download via Cobalt ─────────────────────────────────────────────
// GET /api/v1/download/youtube
// Calls Cobalt API server-side → gets merged video+audio URL → redirects browser
//
// Query params:
//   url     — original YouTube URL (required)
//   quality — video quality e.g. "1080", "720", "480", "360" (default: "720")
//   audio   — "1" for audio-only mp3 download
// ─────────────────────────────────────────────────────────────────────────────
router.get('/download/youtube', async (req, res) => {
  const { url, quality = '720', audio = '0' } = req.query;

  if (!url) return res.status(400).json({ error: 'url query param required' });

  try {
    const isAudio = audio === '1';
    const mergedUrl = await getCobaltDownloadUrl(
      decodeURIComponent(url),
      quality,
      isAudio
    );

    if (!mergedUrl) {
      return res.status(500).json({ error: 'Cobalt did not return a download URL' });
    }

    console.log(`[YouTube] Redirecting to Cobalt URL: ${mergedUrl.substring(0, 80)}...`);
    // Redirect the browser to cobalt's merged stream URL
    res.redirect(302, mergedUrl);

  } catch (err) {
    console.error('[YouTube] Cobalt error:', err.message);
    res.status(500).json({ error: 'YouTube download failed: ' + err.message.substring(0, 150) });
  }
});


// GET /api/v1/download/proxy
// Downloads video (+ optionally audio) from CDN, merges with ffmpeg → streams mp4
//
// Query params:
//   videoUrl  — CDN URL of the video stream (required)
//   audioUrl  — CDN URL of the audio stream (optional, for merge)
//   title     — filename (optional)
//   audio     — "1" to download audio-only as mp3
// ─────────────────────────────────────────────────────────────────────────────
router.get('/download/proxy', async (req, res) => {
  const { videoUrl, audioUrl, title = 'FETCH_video', audio = '0' } = req.query;

  if (!videoUrl) return res.status(400).json({ error: 'videoUrl is required' });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fetchly_'));
  const safeName = (title || 'FETCH').replace(/[^\w\s-]/g, '').trim().substring(0, 60);

  try {
    const isAudio = audio === '1';

    if (isAudio) {
      // ── Audio-only: download audio stream, convert to mp3 ──────────────
      const srcUrl = audioUrl || videoUrl;
      const rawAudio = path.join(tmpDir, 'audio_raw');
      const outMp3  = path.join(tmpDir, 'output.mp3');

      console.log('[Proxy] Downloading audio stream...');
      await downloadUrl(srcUrl, rawAudio);

      console.log('[Proxy] Converting to mp3...');
      const ffmpegQ = `"${FFMPEG_PATH}" -y -i "${rawAudio}" -vn -acodec libmp3lame -q:a 2 "${outMp3}"`;
      await execAsync(ffmpegQ, { timeout: 120000 });

      const stat = fs.statSync(outMp3);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.mp3"`);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(outMp3).pipe(res).on('finish', () => cleanup(tmpDir));

    } else if (audioUrl) {
      // ── Video + Audio: download both, merge into mp4 ───────────────────
      const rawVideo = path.join(tmpDir, 'video_raw');
      const rawAudio = path.join(tmpDir, 'audio_raw');
      const outMp4   = path.join(tmpDir, 'output.mp4');

      console.log('[Proxy] Downloading video + audio streams in parallel...');
      await Promise.all([
        downloadUrl(videoUrl, rawVideo),
        downloadUrl(audioUrl, rawAudio),
      ]);

      console.log('[Proxy] Merging video + audio with ffmpeg...');
      const ffmpegCmd = `"${FFMPEG_PATH}" -y -i "${rawVideo}" -i "${rawAudio}" -c:v copy -c:a aac -movflags +faststart "${outMp4}"`;
      await execAsync(ffmpegCmd, { timeout: 180000 });

      const stat = fs.statSync(outMp4);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.mp4"`);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(outMp4).pipe(res).on('finish', () => cleanup(tmpDir));

    } else {
      // ── Video only (already combined stream): re-encode to mp4 ────────
      const rawVideo = path.join(tmpDir, 'video_raw');
      const outMp4   = path.join(tmpDir, 'output.mp4');

      console.log('[Proxy] Downloading combined video stream...');
      await downloadUrl(videoUrl, rawVideo);

      console.log('[Proxy] Re-encoding to mp4 for compatibility...');
      const ffmpegCmd = `"${FFMPEG_PATH}" -y -i "${rawVideo}" -c:v copy -c:a aac -movflags +faststart "${outMp4}"`;
      await execAsync(ffmpegCmd, { timeout: 180000 });

      const stat = fs.statSync(outMp4);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.mp4"`);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(outMp4).pipe(res).on('finish', () => cleanup(tmpDir));
    }

    res.on('close', () => cleanup(tmpDir));

  } catch (err) {
    cleanup(tmpDir);
    console.error('[Proxy] Error:', err.message?.substring(0, 300));
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed: ' + (err.message?.substring(0, 100) || 'Unknown error') });
    }
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Download a URL to a local file path using Node's built-in fetch.
 * Follows redirects automatically.
 */
async function downloadUrl(url, destPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Referer': 'https://www.youtube.com/',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download stream: HTTP ${response.status} from CDN`);
  }

  const fileStream = fs.createWriteStream(destPath);
  const reader = response.body.getReader();

  await new Promise((resolve, reject) => {
    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) {
          fileStream.end();
          resolve();
          return;
        }
        fileStream.write(Buffer.from(value), pump);
      }).catch(reject);
    }
    pump();
    fileStream.on('error', reject);
  });
}

function cleanup(dir) {
  setTimeout(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }, 5000);
}

export default router;
