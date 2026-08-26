import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export const PLATFORMS = {
  youtube: {
    name: 'YouTube', key: 'youtube', cls: 'yt', icon: 'fab fa-youtube',
    patterns: [
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/
    ]
  },
  instagram: {
    name: 'Instagram', key: 'instagram', cls: 'ig', icon: 'fab fa-instagram',
    patterns: [/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/]
  },
  facebook: {
    name: 'Facebook', key: 'facebook', cls: 'fb', icon: 'fab fa-facebook-f',
    patterns: [
      /facebook\.com\/watch/, /facebook\.com\/.*\/videos\/[0-9]+/, /fb\.watch\/[a-zA-Z0-9_-]+/
    ]
  },
  tiktok: {
    name: 'TikTok', key: 'tiktok', cls: 'tt', icon: 'fab fa-tiktok',
    patterns: [
      /tiktok\.com\/@[^\/]+\/video\/[0-9]+/, /vm\.tiktok\.com\/[a-zA-Z0-9_-]+/
    ]
  },
  twitter: {
    name: 'Twitter / X', key: 'twitter', cls: 'tw', icon: 'fab fa-x-twitter',
    patterns: [/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/[0-9]+/]
  }
};

export function detectPlatform(url) {
  if (!url || typeof url !== 'string') return { supported: false, error: 'Invalid URL' };
  const trimmed = url.trim();
  for (const [, plat] of Object.entries(PLATFORMS)) {
    if (plat.patterns.some(p => p.test(trimmed))) {
      return { supported: true, platform: plat.key, label: plat.name, cls: plat.cls, icon: plat.icon };
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { supported: true, platform: 'general', label: 'Video Link', cls: 'yt', icon: 'fas fa-globe' };
  }
  return { supported: false, error: 'Unsupported platform. Paste a YouTube, Instagram, TikTok, Facebook, or X link.' };
}


function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  let s = Math.round(Number(seconds));
  if (s > 86400) s = Math.round(s / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const mb = bytes / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}


export async function resolveWithYtdlp(url) {
  try {
    console.log(`[yt-dlp] Resolving: ${url}`);


    const { stdout, stderr } = await execAsync(
      `yt-dlp --dump-json --no-playlist --skip-download --no-warnings "${url.replace(/"/g, '')}"`,
      { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }
    );

    const info = JSON.parse(stdout.trim().split('\n')[0]);

    const title = info.title || 'Untitled Video';
    const author = info.uploader || info.channel || info.uploader_id || '@creator';
    const duration = formatDuration(info.duration);
    const thumbnail = info.thumbnail || '';


    const WANTED_HEIGHTS = [2160, 1440, 1080, 720, 480, 360, 240];
    const seen = new Set();
    const videos = [];

    if (info.formats) {

      const sorted = [...info.formats].sort((a, b) => (b.height || 0) - (a.height || 0));

      for (const f of sorted) {
        const h = f.height;
        if (!h || f.vcodec === 'none' || !f.url) continue;
        if (!WANTED_HEIGHTS.includes(h) && h < 240) continue;
        if (seen.has(h)) continue;
        seen.add(h);

        const label = h >= 2160 ? '4K' : h >= 1440 ? '1440p' : `${h}p`;
        const isHD = h >= 1080;
        videos.push({
          id: `ytdlp_${f.format_id}`,
          quality: isHD ? `${label} HD` : label,
          detail: `${(f.ext || 'mp4').toUpperCase()} · ~${formatSize(f.filesize || f.filesize_approx || 0)}`,
          url: f.url,
          extension: f.ext || 'mp4',
          height: h,
          formatId: f.format_id,
          requiresMerge: false
        });

        if (videos.length >= 4) break;
      }
    }

    const audioStreams = [];
    if (info.formats) {
      const audioFmt = info.formats
        .filter(f => f.acodec !== 'none' && f.vcodec === 'none' && f.url)
        .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

      if (audioFmt) {
        audioStreams.push({
          id: `ytdlp_audio_${audioFmt.format_id}`,
          quality: 'Best Audio',
          detail: `${(audioFmt.ext || 'mp3').toUpperCase()} · ${audioFmt.abr || 128} kbps`,
          url: audioFmt.url,
          extension: audioFmt.ext || 'webm',
          formatId: audioFmt.format_id
        });
      }
    }

    if (videos.length === 0 && info.url) {
      videos.push({
        id: 'ytdlp_best',
        quality: 'Best Quality',
        detail: 'MP4 (combined)',
        url: info.url,
        extension: info.ext || 'mp4'
      });
    }

    console.log(`[yt-dlp] Success: ${title} — ${videos.length} video formats, ${audioStreams.length} audio streams`);

    return {
      success: true,
      title, author, duration, thumbnail,
      videos, audioStreams,
      audioFormats: ['MP3', 'M4A'],
      audioQualities: ['320 kbps', '192 kbps', '128 kbps']
    };
  } catch (err) {
    console.error('[yt-dlp] Failed:', err.message?.substring(0, 200));
    return { success: false, error: err.message };
  }
}

export async function downloadWithYtdlp(url, formatId, outputDir) {
  const outTemplate = path.join(outputDir, `fetch_%(id)s.%(ext)s`);
  const fmtArg = formatId ? `-f "${formatId}+bestaudio/best"` : '-f best';

  const { stdout } = await execAsync(
    `yt-dlp ${fmtArg} --merge-output-format mp4 --no-playlist -o "${outTemplate}" --print after_move:filepath "${url.replace(/"/g, '')}"`,
    { timeout: 120000, maxBuffer: 5 * 1024 * 1024 }
  );

  return stdout.trim().split('\n').pop();
}

export async function resolveMedia(url) {
  const detection = detectPlatform(url);
  if (!detection.supported) throw new Error(detection.error);

  const result = await resolveWithYtdlp(url);
  if (result.success) {
    return { platform: detection, ...result };
  }

  throw new Error(
    result.error?.includes('Private video') ? 'This video is private or restricted.' :
    result.error?.includes('not available') ? 'This video is not available in your region or has been deleted.' :
    result.error?.includes('age') ? 'Age-restricted content requires sign-in — not supported.' :
    `Could not extract media: ${result.error?.substring(0, 100) || 'Unknown error'}`
  );
}
