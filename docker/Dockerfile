# Dockerfile for HappyCash (frontend build + Nginx runtime)
# ---------------------------------------------------------
# Stage 1 – Build the Vite/React app
FROM node:20-alpine AS builder
WORKDIR /app
# Copy only package files to leverage layer caching
COPY package.json package-lock.json* .
RUN npm ci
# Copy source code
COPY . .
# Build the production bundle (output goes to /app/dist)
RUN npm run build

# Stage 2 – Serve with lightweight Nginx
FROM nginx:alpine
# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*
# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
# Expose port 80 for the web server
EXPOSE 80
# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
