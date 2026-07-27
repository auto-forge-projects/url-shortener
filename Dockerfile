# Faz 12 (CI/CD) — url-shortener production image.
#
# Zero runtime dependencies (package.json.dependencies is empty — SEC-13),
# so there is no `npm ci`/`npm install` step: nothing to fetch from a
# registry, nothing to cache. Not multi-stage on purpose — a build stage
# would add complexity with no payoff here.
#
# Base image is pinned to the exact Node patch used in development
# (v22.23.1) so `node:sqlite` (experimental) behaves identically in CI,
# local dev and production (docs/07-security.md SEC-13: "temel imaj sabit
# Node sürüm etiketi/digest").
FROM node:22.23.1-alpine

WORKDIR /app

# Only what the runtime needs — no tests/docs/decisions in the image.
COPY package.json ./
COPY src ./src

# SEC-12 — persistent volume for the SQLite file, owned by the non-root
# runtime user ahead of time (USER switch below means the process itself
# can never chown/create top-level dirs as root).
RUN mkdir -p /data && chown -R node:node /data /app

ENV NODE_ENV=production \
    DB_PATH=/data/links.db \
    PORT=3000

# SEC-12 — non-root runtime. The `node` user/group already exists in the
# official image (uid/gid 1000).
USER node

EXPOSE 3000

VOLUME ["/data"]

# SEC-15 — /health returns a fixed {"status":"ok"} payload with no secrets,
# safe to probe from inside the container. wget (busybox) is present in
# alpine by default; curl is not installed on purpose (image size — task
# constraint, no extra package for a check this simple).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 || exit 1

CMD ["node", "src/server.js"]
