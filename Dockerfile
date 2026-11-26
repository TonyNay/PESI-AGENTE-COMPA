# Imagen de producción para Coolify (u otro host Docker).
# node:sqlite requiere Node >= 22.13; usamos Node 24 LTS.
FROM node:24-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    AGENT_PROVIDER=anthropic \
    COMPA_DB_PATH=/app/storage/compa.db

# La base SQLite vive en /app/storage: monta ahí un volumen persistente.
# (No se monta sobre /app/data porque ahí está seed-analyses.json.)
RUN mkdir -p /app/storage
EXPOSE 3000

# El seed es idempotente: crea la cuenta demo y los datos de ejemplo solo si faltan.
CMD ["sh", "-c", "npx tsx scripts/seed.ts && npm start"]
