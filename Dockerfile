# PC Bastos Harvest Management System 2026
# Production Multi-Stage Dockerfile

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (sqlite3, bcrypt)
RUN apk add --no-cache python3 make g++ sqlite

COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache sqlite

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/harvest.sqlite

# Create persistent data directory
RUN mkdir -p /app/data

# Copy built node_modules and application code
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/
COPY data/ ./data/

# Run migrations and seed if needed upon startup
EXPOSE 3000

VOLUME ["/app/data"]

CMD ["npm", "start"]
