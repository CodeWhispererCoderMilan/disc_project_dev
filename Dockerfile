# syntax=docker/dockerfile:1

### Base dependencies layer (installs all deps using your lockfile)
FROM node:20-alpine AS deps
WORKDIR /app

# If you use npm:
COPY package*.json ./
RUN npm ci



### Runtime image (small, production)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of your source
COPY . .

# Optional: if native modules ever fail on Alpine, uncomment toolchain:
# RUN apk add --no-cache python3 make g++  # only if you compile native addons

# Use the non-root Node user provided by the base image
USER node

# Your app's start command (change entrypoint if not index.js)
CMD ["node", "index.js"]

