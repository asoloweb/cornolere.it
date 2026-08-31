# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time configuration.
# Coolify automatically injects configured env vars as build args,
# overriding these defaults.
ARG PUBLIC_DIRECTUS_URL=https://admin.cornolere.it
ARG PUBLIC_SITE_URL=https://test.cornolere.it
ARG PUBLIC_PARTECIPA_WEBHOOK_URL=
ARG PUBLIC_DIRECTUS_WEBHOOK_RICHIESTE=
ARG PUBLIC_DIRECTUS_FLOW_TRIGGER_ID=
ARG GOOGLE_MYBUSINESS_PLACE_ID=
ENV PUBLIC_DIRECTUS_URL=$PUBLIC_DIRECTUS_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
ENV ASTRO_ADAPTER=node

RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
