# syntax=docker/dockerfile:1.6

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

# nucleo-pixel's preinstall script reads NUCLEO_LICENSE_KEY from env. We mount
# it as a BuildKit secret so it's available only during `pnpm install` and
# never written into an image layer. Provide it via `--build-secret` at deploy.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=secret,id=NUCLEO_LICENSE_KEY \
    NUCLEO_LICENSE_KEY="$(cat /run/secrets/NUCLEO_LICENSE_KEY)" \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- Runtime stage ----
FROM pierrezemb/gostatic
COPY --from=builder /app/dist /srv/http/
CMD ["-port", "8080", "-https-promote", "-enable-logging"]
