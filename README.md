# FETCH Media Downloader

An all-in-one web application to download video and audio from popular social media platforms including Instagram, Facebook, TikTok, X (Twitter), and YouTube.

## Features
- **Cross-Platform:** Works seamlessly on desktop and mobile browsers.
- **Universal Downloader:** Paste links from multiple platforms; it auto-detects and extracts available media formats.
- **Cloud-Friendly API:** Uses RapidAPI backend instead of local command-line tools to avoid data-center IP blocks.
- **Direct CDN Downloads:** Videos and audio are downloaded directly to the browser from the source CDN.

## Requirements
- **Node.js** (v18+)
- **RapidAPI Account** (to get an API key for the extraction service)

## Setup & Installation

### 1. Get an API Key
1. Go to [RapidAPI - Social Download All in One](https://rapidapi.com/social-download-all-in-one) and subscribe to the free tier.
2. Copy your `X-RapidAPI-Key`.

### 2. Local Setup
```bash
# Clone the repository
git clone https://github.com/shivanshh-oo/fetch.git
cd fetch

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env 
# (Or manually create a .env file and add: RAPIDAPI_KEY=your_key_here)

# Start the frontend and backend concurrently
npm run dev
```

The frontend will run on `http://localhost:3000` and the backend API will run on `http://localhost:5000`.

## Deployment (Render.com)

This app is fully containerized and optimized for **Render's Free Tier**.

1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Select **Docker** as the Runtime environment.
4. Under **Environment Variables**, add:
   - Key: `RAPIDAPI_KEY`
   - Value: `your_actual_rapidapi_key`
5. Click **Deploy**.

## Tech Stack
- **Frontend:** React, Vite, Vanilla CSS
- **Backend:** Express.js, Node.js
- **Extractor:** RapidAPI (Social Download All in One)
- **Containerization:** Docker

## Notes on YouTube Downloads
Due to aggressive anti-bot protections by YouTube (which block all cloud server IPs with HTTP 403 Forbidden errors), YouTube videos are delivered exactly as YouTube hosts them: high-quality video and audio are often in separate streams. 

The app allows you to download the video track and the audio track separately. Other platforms (TikTok, Instagram, Twitter) provide pre-merged streams and download perfectly with audio included.
