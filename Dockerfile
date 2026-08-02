FROM node:22.16.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global typescript@5.8.3
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY types ./types
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tests ./tests
RUN npm run build

FROM node:22.16.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 10001 opensrcwa \
  && useradd --system --uid 10001 --gid opensrcwa --home-dir /app opensrcwa \
  && mkdir -p /app/runtime \
  && chown -R opensrcwa:opensrcwa /app
COPY --from=build --chown=opensrcwa:opensrcwa /app/dist ./dist
COPY --chown=opensrcwa:opensrcwa package.json ./package.json
USER opensrcwa
EXPOSE 3000
VOLUME ["/app/runtime"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/apps/gateway/src/index.js"]
