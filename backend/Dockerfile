# ─── Stage 1: Build ───────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
