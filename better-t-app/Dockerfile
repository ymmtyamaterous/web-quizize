# syntax=docker/dockerfile:1

# ── Stage 1: Pruner ──────────────────────────────────────────────────────────
# Turborepo の prune で server / web に必要なファイルのみを抽出する
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
# turbo はルート devDependencies に含まれているため bunx で実行可能
RUN bun install --frozen-lockfile && \
    bunx turbo prune server web --docker

# ── Stage 2: Installer ───────────────────────────────────────────────────────
# package.json / lockfile のみコピー → bun install をキャッシュレイヤーとして分離
# (依存関係が変わらない限りこのレイヤーは再利用される)
FROM oven/bun:1 AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

# ── Stage 3: Builder ─────────────────────────────────────────────────────────
# node_modules はインストールレイヤーから、ソースは pruner から取得してビルド
FROM oven/bun:1 AS builder
# Vite ビルド時に静的埋め込みされる値。--build-arg で渡す
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN bun run build

# ── Stage 4: Native Dependencies ──────────────────────────────────────────────────
# libsql と native binary を非 workspace 環境でインストールする独立ステージ
# bun の .bun 仮想ストアを利用した脆弱な find/cp アプローチを回避する
FROM oven/bun:1 AS native-deps
WORKDIR /deps
# libsql のバージョンは package.json catalog と合わせる (libsql: 0.5.22)
RUN printf '{"type":"module","dependencies":{"libsql":"0.5.22"}}' > package.json && \
    bun install --production

# ── Stage 5: Runner ──────────────────────────────────────────────────────────
FROM oven/bun:1-slim
WORKDIR /app
# マイグレーションフォルダを明示的に指定する環境変数
# runMigrations() はこの変数を優先して参照する
ENV MIGRATIONS_FOLDER=/app/migrations
# フロントエンド (SPA 静的ファイル)
COPY --from=builder /app/apps/web/dist ./web
# バックエンド (バンドル済みサーバー - better-auth/hono/@orpc/drizzle-orm 等は全てインライン済み)
COPY --from=builder /app/apps/server/dist ./server
# マイグレーション SQL ファイル
# MIGRATIONS_FOLDER=/app/migrations と対応する場所に配置する
COPY --from=builder /app/packages/db/src/migrations ./migrations
# libsql と native binary (tsdown バンドルに含められないネイティブモジュール)
# native-deps ステージで非 workspace 環境にインストールした node_modules を丸ごとコピー
COPY --from=native-deps /deps/node_modules ./node_modules

CMD ["bun", "server/index.mjs"]
