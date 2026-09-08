# Image de production Next.js (build standalone).
# Contexte de build : la racine du projet (voir docker-compose.yml).

FROM node:24-alpine AS builder
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Les variables NEXT_PUBLIC_* sont figées dans le bundle au moment du
# build : elles doivent exister ici, pas seulement à l'exécution.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
ENV NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app
ENV NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
ENV PORT=80
# Docker positionne HOSTNAME au nom du conteneur ; le serveur standalone de
# Next.js s'y attacherait et ne serait joignable que sur un seul des deux
# réseaux (web/back). 0.0.0.0 = écoute sur toutes les interfaces.
ENV HOSTNAME=0.0.0.0
EXPOSE 80
USER node
CMD ["node", "server.js"]
