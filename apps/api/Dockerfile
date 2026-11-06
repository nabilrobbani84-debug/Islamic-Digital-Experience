# Build dari ROOT monorepo:  docker build -f apps/api/Dockerfile -t nur-api .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/islamic-calculations/package.json packages/islamic-calculations/package.json
RUN npm ci --workspace @nur/api --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build -w @nur/api

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
# CLI Prisma (devDependency) tetap dibawa agar `prisma migrate deploy` dapat dijalankan dari image yang sama.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN mkdir -p /repo/apps/api/storage && chown -R node:node /repo/apps/api/storage
WORKDIR /repo/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
