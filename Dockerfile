FROM node:18-bullseye-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install ALL dependencies (including devDeps needed for Vite build)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Vite frontend (requires devDependencies like vite)
RUN npm run build

# Expose the port the server runs on
EXPOSE 5000

# Start the Express server
CMD ["node", "server/index.js"]
