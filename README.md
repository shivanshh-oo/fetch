# FETCH Media Downloader

An all-in-one web application to download video and audio from popular social media platforms including YouTube, Instagram, Facebook, TikTok, and X (Twitter).

## Features
- **Cross-Platform:** Works on desktop and mobile browsers.
- **Universal Downloader:** Paste links from multiple platforms; it auto-detects and extracts available media.
- **Video & Audio:** Download HD video (merged with audio) or extract raw audio streams (MP3/M4A).
- **Self-Hosted Engine:** Uses a Node.js backend paired with `yt-dlp` and `ffmpeg` to securely process streams server-side.

## Requirements
- **Node.js** (v18+)
- **Python 3.10+**
- **yt-dlp** (`pip install yt-dlp`)
- **FFmpeg** (Must be installed and accessible in PATH for stream merging)

## Installation

```bash
# Install dependencies
npm install

# Start the frontend and backend concurrently
npm run dev
```

The frontend will run on `http://localhost:3000` (or `3001` if taken) and the backend API will run on `http://localhost:5000`.

## Tech Stack
- Frontend: React, Vite, Vanilla CSS
- Backend: Express.js, Node.js
- Extractor: yt-dlp + FFmpeg
