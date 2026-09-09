# Étape de construction : Vite a besoin des devDependencies, l'image finale non.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Image finale : le serveur statique et le site construit, rien d'autre.
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server.ts ./

ENV LOFI_ROOT=/app/dist \
    LOFI_PORT=4707 \
    LOFI_HOST=0.0.0.0

EXPOSE 4707
CMD ["bun", "run", "server.ts"]
