# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build: bun installs against bun.lock, tsc compiles, then a production-only
# reinstall drops dev dependencies. node-gyp is installed globally because bun
# does not put npm's bundled node-gyp on the script PATH, and better-sqlite3's
# binding.gyp triggers an implicit `node-gyp rebuild`.
# ---------------------------------------------------------------------------
FROM node:22-trixie-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g bun node-gyp
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN bun run build
RUN rm -rf node_modules && bun install --frozen-lockfile --production

# ---------------------------------------------------------------------------
# Runtime: single Node process. SQLite persists under /data — attach a volume
# there (e.g. a Railway Volume) and the DATA_DIR default picks it up.
# No VOLUME instruction: Railway rejects it; volumes are attached in service config.
# ---------------------------------------------------------------------------
FROM node:22-trixie-slim AS runtime
ENV NODE_ENV=production
ENV DATA_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
