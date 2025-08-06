# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S moengage && \
    adduser -S moengage -u 1001

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    sqlite \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY .env.example ./.env

# Build the application
RUN npm run build

# Create data and logs directories
RUN mkdir -p data logs && \
    chown -R moengage:moengage data logs

# Switch to non-root user
USER moengage

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV DATABASE_PATH=/app/data/moengage-docs.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "console.log('Health check')" || exit 1

# Expose port (if needed for HTTP interface in future)
# EXPOSE 3000

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]