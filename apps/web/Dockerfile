# Build dari ROOT monorepo:  docker build -f apps/web/Dockerfile -t nur-web .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/islamic-calculations/package.json packages/islamic-calculations/package.json
RUN npm ci --workspace @nur/web --workspace @nur/islamic-calculations --no-audit --no-fund
COPY packages/islamic-calculations packages/islamic-calculations
COPY apps/web apps/web
# Build produksi: adapter mock otomatis dibuang (lihat src/lib/env.ts).
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build -w @nur/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
