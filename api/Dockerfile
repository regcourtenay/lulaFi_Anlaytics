# Multi-arch base image; runs natively on Raspberry Pi 5 (arm64).
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

# Entry seeds the DB on first boot (idempotent) then starts the API.
CMD ["node", "src/index.js"]
