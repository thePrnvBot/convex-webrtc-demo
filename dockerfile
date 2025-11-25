# Use a light Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json* bun.lock* ./

# Install dependencies (using npm based on your logs)
# If you prefer bun, verify you have it or switch to 'npm ci'
RUN npm install

# Copy the rest of your app source code
COPY . .

# Expose the port Vite runs on
EXPOSE 3000

# Start the development server
# Note: We rely on your vite.config.ts having 'host: true'
CMD ["npm", "run", "dev:web"]