FROM node:18-alpine AS base

# Stage 1: Builder
FROM base as builder

WORKDIR /app

RUN apk add --no-cache git

RUN apk update && apk add --no-cache nmap && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk update 

RUN apk add --no-cache \
      chromium \
      harfbuzz \
      "freetype>2.8" \
      ttf-freefont \
      nss \
      tzdata

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install
RUN npm install -g typescript

# Copy the rest of the application
COPY . .

RUN npm run prisma-merge

# Build the application
RUN npm run buildOnce
RUN npm run packageJsonStripper

# Stage 2: Production image
FROM base as production

RUN apk update && apk add --no-cache nmap && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk update 

RUN apk add --no-cache \
      chromium \
      harfbuzz \
      "freetype>2.8" \
      ttf-freefont \
      nss \
      tzdata

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true


# Set the working directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app/build ./build

# Copy package.json and package-lock.json
COPY --from=builder /app/packageProduction.json ./package.json

RUN ls -l

# Install only production dependencies
RUN npm install

# Copy the Prisma client from the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# set the memory limit to  3gb and run the application
CMD ["node", "--max-old-space-size=3072", "build/index.js"]