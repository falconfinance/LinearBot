# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite database and logs
RUN mkdir -p /data/logs

# Set environment to production
ENV NODE_ENV=production

# Expose port (if needed in future for health checks)
EXPOSE 3000

# Run the bot
CMD ["npm", "start"]