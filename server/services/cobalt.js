/**
 * Cobalt.tools API integration for YouTube downloads (merged video+audio)
 *
 * Auth: Cobalt's official API (api.cobalt.tools) now requires an API key.
 * Get a free key at: https://cobalt.tools  (Settings → API Key)
 * Set it in .env as: COBALT_API_KEY=your_key_here
 *
 * Fallback: If no key is set, we try public community cobalt instances.
 */

// Official API — requires COBALT_API_KEY
const COBALT_OFFICIAL = 'https://api.cobalt.tools/';

// Public community instances (no auth needed, but may be slower/less reliable)
// Source: https://instances.cobalt.best
const COBALT_PUBLIC_INSTANCES = [
  'https://co.wuk.sh/',
  'https://cobalt.urdailyinfo.link/',
  'https://cobalt.api.timelessnesses.me/',
  'https://cobalt.flick.tech/',
];

/**
 * Make one attempt to the given cobalt instance URL.
 * Returns the download URL string or throws.
 */
async function tryCobaltInstance(instanceUrl, youtubeUrl, quality, audioOnly) {
  const apiKey = process.env.COBALT_API_KEY;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // Add auth header only if we have a key
  if (apiKey) {
    headers['Authorization'] = `Api-Key ${apiKey}`;
  }

  const body = {
    url: youtubeUrl,
    downloadMode: audioOnly ? 'audio' : 'auto',
    videoQuality: quality,
    audioFormat: 'mp3',
    filenameStyle: 'basic',
  };

  const response = await fetch(instanceUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000), // 10s per instance
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    const code = data.error?.code || `HTTP ${response.status}`;
    throw new Error(code);
  }

  if (data.status === 'tunnel' || data.status === 'redirect') {
    return data.url;
  }

  if (data.status === 'picker' && Array.isArray(data.picker)) {
    const best = data.picker[0]?.url;
    if (best) return best;
  }

  throw new Error(`Unexpected status: ${data.status}`);
}

/**
 * Get a merged YouTube download URL from Cobalt.
 * Tries the official API first (if COBALT_API_KEY is set), then public instances.
 *
 * @param {string} url         - Original YouTube URL
 * @param {string} quality     - "1080", "720", "480", "360"
 * @param {boolean} audioOnly  - true for mp3 download
 */
export async function getCobaltDownloadUrl(url, quality = '720', audioOnly = false) {
  const apiKey = process.env.COBALT_API_KEY;

  // Build the list of instances to try
  const instancesToTry = apiKey
    ? [COBALT_OFFICIAL, ...COBALT_PUBLIC_INSTANCES]   // official first if we have a key
    : COBALT_PUBLIC_INSTANCES;                         // public only if no key

  let lastError = null;

  for (const instance of instancesToTry) {
    try {
      console.log(`[Cobalt] Trying ${instance} for ${audioOnly ? 'audio' : quality + 'p video'}...`);
      const dlUrl = await tryCobaltInstance(instance, url, quality, audioOnly);
      console.log(`[Cobalt] ✅ Got URL from ${instance}`);
      return dlUrl;
    } catch (err) {
      console.warn(`[Cobalt] ❌ ${instance} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All Cobalt instances failed. Last error: ${lastError?.message}`);
}
