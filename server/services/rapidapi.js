/**
 * RapidAPI "Social Download All-in-One" service
 * Replaces yt-dlp as the media extraction backend.
 * API docs: https://rapidapi.com/social-download-all-in-one
 */

const RAPIDAPI_URL = 'https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'YOUR_OWN_RAPIDAPI_KEY_HERE';
const RAPIDAPI_HOST = 'social-download-all-in-one.p.rapidapi.com';

/**
 * Detect platform from URL (same logic as frontend badge)
 */
function detectPlatform(url) {
  const PLATFORMS = [
    { key: 'youtube',   label: 'YouTube',    cls: 'yt', icon: 'fab fa-youtube',    re: /(?:youtube\.com|youtu\.be)/i },
    { key: 'instagram', label: 'Instagram',  cls: 'ig', icon: 'fab fa-instagram',  re: /instagram\.com/i },
    { key: 'facebook',  label: 'Facebook',   cls: 'fb', icon: 'fab fa-facebook-f', re: /(?:facebook\.com|fb\.watch)/i },
    { key: 'tiktok',    label: 'TikTok',     cls: 'tt', icon: 'fab fa-tiktok',     re: /tiktok\.com/i },
    { key: 'twitter',   label: 'Twitter / X',cls: 'tw', icon: 'fab fa-x-twitter',  re: /(?:twitter\.com|x\.com)/i },
  ];

  if (!url || typeof url !== 'string') return { supported: false, error: 'Invalid URL' };
  const trimmed = url.trim();

  for (const p of PLATFORMS) {
    if (p.re.test(trimmed)) return { supported: true, ...p };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { supported: true, key: 'general', label: 'Video Link', cls: 'yt', icon: 'fas fa-globe' };
  }

  return { supported: false, error: 'Unsupported platform. Paste a YouTube, Instagram, TikTok, Facebook, or X link.' };
}

/**
 * Format file size bytes to human readable string
 */
function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const mb = bytes / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * Map a RapidAPI quality string to something human-friendly.
 * API returns strings like "hd", "sd", "audio", "360p", "720p", etc.
 */
function mapQualityLabel(media) {
  const q = (media.quality || '').toLowerCase().trim();
  const ext = (media.extension || '').toUpperCase();

  if (q === 'hd' || q === '1080p' || q === '1080') return '1080p HD';
  if (q === '720p' || q === '720')  return '720p HD';
  if (q === '480p' || q === '480')  return '480p';
  if (q === '360p' || q === '360')  return '360p';
  if (q === '240p' || q === '240')  return '240p';
  if (q === 'sd')                   return '480p SD';
  if (q === '4k' || q === '2160p')  return '4K';
  if (q === 'audio' || media.type === 'audio') return 'Best Audio';
  // Capitalise whatever string the API returned as fallback
  return q.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Video';
}

/**
 * Height number from quality label (used for video sorting)
 */
function heightFromLabel(label) {
  const m = label.match(/(\d{3,4})p?/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Call RapidAPI and return data in the shape the ResultsPage expects:
 * {
 *   success: true,
 *   title, author, duration, thumbnail,
 *   platform: { key, label, cls, icon },
 *   videos: [{ id, quality, detail, url, extension, height }],
 *   audioStreams: [{ id, quality, detail, url, extension }],
 *   audioFormats: ['MP3','M4A'],
 *   audioQualities: ['320 kbps','192 kbps','128 kbps']
 * }
 */
export async function resolveWithRapidApi(url) {
  console.log(`[RapidAPI] Resolving: ${url}`);

  const response = await fetch(RAPIDAPI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Host': RAPIDAPI_HOST,
      'X-RapidAPI-Key': RAPIDAPI_KEY,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`RapidAPI HTTP ${response.status}: ${body.substring(0, 200)}`);
  }

  const data = await response.json();
  console.log(`[RapidAPI] Raw response keys: ${Object.keys(data).join(', ')}`);

  if (data.error) {
    throw new Error(data.message || 'RapidAPI returned an error');
  }

  const medias = Array.isArray(data.medias) ? data.medias : [];

  // Split into video vs audio tracks
  const videoMedias = medias.filter(m => m.type !== 'audio');
  const audioMedias = medias.filter(m => m.type === 'audio');

  // Pick the best audio stream URL (for server-side merge)
  const bestAudioUrl = audioMedias[0]?.url || '';

  // Build videos array — deduplicate by quality label, sort best first
  const seenQualities = new Set();
  const videos = videoMedias
    .map((m, i) => {
      const label = mapQualityLabel(m);
      const size = formatSize(m.data_size);
      const ext = (m.extension || 'mp4').toUpperCase();
      return {
        id: `rapid_${i}`,
        quality: label,
        detail: `MP4${size ? ' · ~' + size : ''}`,
        url: m.url,
        // Always attach the best audio URL so the server can merge them
        audioUrl: bestAudioUrl,
        extension: m.extension || 'mp4',
        height: m.height || heightFromLabel(label),
      };
    })
    .filter(v => {
      if (seenQualities.has(v.quality)) return false;
      seenQualities.add(v.quality);
      return true;
    })
    .sort((a, b) => b.height - a.height)
    .slice(0, 5);

  // Build audio streams
  const audioStreams = audioMedias.map((m, i) => {
    const ext = (m.extension || 'mp3').toUpperCase();
    const size = formatSize(m.data_size);
    return {
      id: `rapid_audio_${i}`,
      quality: 'Best Audio',
      detail: `${ext}${size ? ' · ~' + size : ''}`,
      url: m.url,
      extension: m.extension || 'mp3',
    };
  }).slice(0, 1);

  const title     = data.title     || 'Untitled Video';
  const author    = data.author    || 'Unknown';
  const duration  = data.duration  || '00:00';
  const thumbnail = data.thumbnail || '';

  const platform = detectPlatform(url);

  console.log(`[RapidAPI] OK — "${title}" | ${videos.length} video(s), ${audioStreams.length} audio(s), bestAudio: ${bestAudioUrl ? 'yes' : 'no'}`);

  return {
    success: true,
    title, author, duration, thumbnail, platform,
    videos,
    audioStreams,
    audioFormats: ['MP3', 'M4A'],
    audioQualities: ['320 kbps', '192 kbps', '128 kbps'],
  };
}
