# syntax=docker/dockerfile:1

# --- build stage -------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage -------------------------------------------------------
# adapter-node's output is fully self-contained (bundles polka/sirv), so the
# final image needs nothing but Node and the build/ directory - no
# node_modules, no npm, no shell tools.
FROM node:24-alpine AS runtime
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/jasanpreetn9/atlas" \
      org.opencontainers.image.description="A unified SvelteKit dashboard over Sonarr and Radarr"

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build --chown=node:node /app/build ./build

# Official node images already ship a low-privilege "node" user (uid/gid 1000).
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "build/index.js"]
