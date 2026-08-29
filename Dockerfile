FROM node:18-bullseye-slim

# Install FFmpeg only (yt-dlp no longer needed)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the application
COPY . .

# Build the Vite frontend
RUN npm run build

# Expose the port the server runs on
EXPOSE 5000

# Start the Express server
CMD ["node", "server/index.js"]
