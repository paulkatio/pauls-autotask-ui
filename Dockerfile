# Multi-stage Build für das Next.js standalone-Bundle.
# Deployment-agnostisch: lokal/Hetzner via Docker, alternativ Vercel (ignoriert
# das Dockerfile). KEINE Secrets ins Image – Env wird zur Laufzeit injiziert.

# 1) Dependencies (separat für besseres Layer-Caching)
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build (erzeugt .next/standalone dank output:'standalone')
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Branding wird zur BUILD-Zeit eingebettet (NEXT_PUBLIC_*). Ohne --build-arg bleibt
# der Default aus lib/branding.ts ("Acme GmbH"). Eigene Marke:
#   docker build --build-arg NEXT_PUBLIC_ORG_NAME=SSIG-IT ...
ARG NEXT_PUBLIC_ORG_NAME
ENV NEXT_PUBLIC_ORG_NAME=$NEXT_PUBLIC_ORG_NAME
# AUTH_SECRET nur für DIESEN Build-Schritt setzen (Auth.js erwartet es beim Build).
# Inline statt ENV-Layer → kein Persistieren im Image, keine Secret-Lint-Warnung;
# das echte Secret wird zur Laufzeit injiziert.
RUN AUTH_SECRET=build-only-dummy-not-used-at-runtime npm run build

# 3) Runtime (schlank, non-root)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root User
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone-Server + statische Assets + public/ kopieren.
# (standalone enthält server.js + minimale node_modules; static/public NICHT.)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Der standalone-Server liest PORT/HOSTNAME aus der Env.
CMD ["node", "server.js"]
