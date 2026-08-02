FROM node:22.16.0-bookworm-slim AS build
WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@10.14.0 --activate \
  && npm install --global typescript@5.8.3

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY types ./types
COPY scripts ./scripts
COPY tests ./tests

RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm prune --prod

FROM node:22.16.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 10001 opensrcwa \
  && useradd --system --uid 10001 --gid opensrcwa --home-dir /app opensrcwa \
  && mkdir -p /app/runtime \
  && chown -R opensrcwa:opensrcwa /app

COPY --from=build --chown=opensrcwa:opensrcwa /app/dist ./dist
COPY --from=build --chown=opensrcwa:opensrcwa /app/node_modules ./node_modules
COPY --from=build --chown=opensrcwa:opensrcwa /app/package.json ./package.json

USER opensrcwa
EXPOSE 3000 3001
VOLUME ["/app/runtime"]

CMD ["node", "dist/apps/gateway/src/index.js"]
