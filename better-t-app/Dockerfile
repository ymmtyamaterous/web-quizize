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
RUN bun run build && \
    # seed スクリプトをバンドル（libsql のみ external として残す）
    bun build --target=bun packages/db/src/seed.ts --outfile packages/db/dist/seed.mjs --external libsql && \
    # libsql は JS ラッパー + プラットフォーム固有 native binary の2パッケージ構成
    # tsdown が pure-JS 依存をすべてバンドルするため、runtime で必要なのはこの2パッケージのみ
    # .bun/ 配下の正規パス (libsql@x.y.z/node_modules/libsql) から直接コピー
    LIBSQL_SRC=$(find /app/node_modules/.bun -maxdepth 3 -type d -name "libsql" -path "*/libsql@*/node_modules/libsql" | head -1) && \
    [ -n "$LIBSQL_SRC" ] && cp -r "$LIBSQL_SRC" /app/node_modules/libsql || true && \
    GNU_SRC=$(find /app/node_modules/.bun -maxdepth 4 -type d -name "linux-x64-gnu" | head -1) && \
    mkdir -p /app/node_modules/@libsql && \
    [ -n "$GNU_SRC" ] && cp -r "$GNU_SRC" /app/node_modules/@libsql/linux-x64-gnu || true && \
    # libsql が内部で依存する @neon-rs/load （純粋 JS・ネイティブモジュールローダー）を抽出
    NEON_LOAD_SRC=$(find /app/node_modules/.bun -type d -name "load" -path "*/@neon-rs/load" 2>/dev/null | head -1) && \
    mkdir -p /app/node_modules/@neon-rs && \
    [ -n "$NEON_LOAD_SRC" ] && cp -r "$NEON_LOAD_SRC" /app/node_modules/@neon-rs/load || true && \
    # libsql が依存する detect-libc を抽出
    DETECT_LIBC_SRC=$(find /app/node_modules/.bun -type d -name "detect-libc" 2>/dev/null | head -1) && \
    [ -n "$DETECT_LIBC_SRC" ] && cp -r "$DETECT_LIBC_SRC" /app/node_modules/detect-libc || true

# ── Stage 4: Runner ──────────────────────────────────────────────────────────
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
# シードスクリプト（バンドル済み）
# 現状 seed データがないためコメントアウト
# COPY --from=builder /app/packages/db/dist/seed.mjs ./seed/seed.mjs
# libsql JS ラッパー + linux-x64-gnu native binary（その他の依存は tsdown バンドルに包含済み）
COPY --from=builder /app/node_modules/libsql ./node_modules/libsql
COPY --from=builder /app/node_modules/@libsql/linux-x64-gnu ./node_modules/@libsql/linux-x64-gnu
# libsql が require する @neon-rs/load（純粋 JS・ネイティブモジュールローダー）
COPY --from=builder /app/node_modules/@neon-rs ./node_modules/@neon-rs
# libsql が依存する detect-libc
COPY --from=builder /app/node_modules/detect-libc ./node_modules/detect-libc

CMD ["bun", "server/index.mjs"]
