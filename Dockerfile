FROM node:24-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

COPY react-router.config.ts tsconfig.json vite.config.ts ./
COPY app ./app
COPY public ./public
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
COPY migrations ./migrations
COPY scripts/serve.mjs ./scripts/serve.mjs
RUN install -d -m 0700 -o node -g node /app/data

USER node
EXPOSE 3000
CMD ["node", "scripts/serve.mjs"]
