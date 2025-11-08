FROM node:18-slim

# Set environment defaults (will be overridden by host / Railway)
ENV NODE_ENV=production
ENV PORT=3000

# Create app directory and use non-root user
WORKDIR /usr/src/app

# Copy package manifests first and install dependencies
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production

# Copy remaining sources
COPY . .

# Expose the configured port (default 3000)
EXPOSE 3000

# Ensure app directory is owned by the non-root `node` user so the container
# can run without root privileges (safer for PaaS like Railway).
RUN chown -R node:node /usr/src/app || true

# Use unprivileged user where available (node official image)
USER node

# Start the server (the app reads process.env.PORT)
CMD ["node", "src/server.js"]
