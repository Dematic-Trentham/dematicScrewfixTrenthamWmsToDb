FROM node:18-alpine AS base

# Stage 1: Builder
FROM base as builder

# Set the working directory
WORKDIR /app

RUN apk add --no-cache git --virtual .gyp python3 make g++

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install --legacy-peer-deps
RUN npm install -g typescript

# Copy the rest of the application
COPY . .

RUN npm run prisma-merge

# Build the application
RUN npm run buildOnce
RUN npm run packageJsonStripper

# Stage 2: Production image
FROM base as builder2

RUN apk add --no-cache git --virtual .gyp python3 make g++

# Set the working directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app/build ./build

# Copy package.json and package-lock.json
COPY --from=builder /app/packageProduction.json ./package.json

# Install only production dependencies
RUN npm install

# Stage 3: Production image
FROM base as production

# Set the working directory
WORKDIR /app

#copy the package.json from the builder2 stage
COPY --from=builder2 /app/package.json ./

#copy the node_modules from the builder2 stage
COPY --from=builder2 /app/node_modules ./node_modules

# Copy the built application from the builder stage
COPY --from=builder /app/build ./build

# Copy the Prisma client from the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# set the memory limit to  3gb and run the application
CMD ["node","build/index.js"]