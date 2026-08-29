/**
 * Cobalt.tools API integration
 * Used specifically for YouTube to get pre-merged video+audio download URLs.
 * Cobalt is a free, open-source tool: https://cobalt.tools
 */

const COBALT_API = 'https://api.cobalt.tools/';

/**
 * Call Cobalt API and return a merged download URL for a YouTube video.
 * @param {string} url         - Original YouTube URL
 * @param {string} quality     - e.g. "1080", "720", "480", "360"
 * @param {boolean} audioOnly  - true to get audio-only mp3
 */
export async function getCobaltDownloadUrl(url, quality = '720', audioOnly = false) {
  console.log(`[Cobalt] Requesting ${audioOnly ? 'audio' : `${quality}p video`} for: ${url}`);

  const body = {
    url,
    downloadMode: audioOnly ? 'audio' : 'auto',
    videoQuality: quality,
    audioFormat: 'mp3',
    filenameStyle: 'basic',
  };

  const response = await fetch(COBALT_API, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Cobalt API HTTP ${response.status}: ${text.substring(0, 150)}`);
  }

  const data = await response.json();
  console.log(`[Cobalt] Response status: ${data.status}`);

  if (data.status === 'error') {
    throw new Error(`Cobalt error: ${data.error?.code || JSON.stringify(data.error)}`);
  }

  // status: "tunnel" | "redirect" — both have a usable .url
  if (data.status === 'tunnel' || data.status === 'redirect') {
    return data.url;
  }

  // status: "picker" — multiple streams; pick the first one
  if (data.status === 'picker' && Array.isArray(data.picker)) {
    return data.picker[0]?.url || null;
  }

  throw new Error(`Unexpected Cobalt response status: ${data.status}`);
}
