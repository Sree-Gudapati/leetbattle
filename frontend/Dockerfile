FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

ARG NEXT_PUBLIC_CODE_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_GAME_URL=https://gameservice-6raq3sj3ba-ew.a.run.app
ARG NEXT_PUBLIC_LOBBY_URL=https://lobbyservice-6raq3sj3ba-ew.a.run.app
ENV NEXT_PUBLIC_CODE_URL=https://codeservice-1040040326387.europe-west1.run.app
ENV NEXT_PUBLIC_AUTH_URL=https://authservice-1040040326387.us-west1.run.app
ENV NEXT_PUBLIC_LOBBY_URL=$NEXT_PUBLIC_LOBBY_URL
ENV NEXT_PUBLIC_GAME_URL=$NEXT_PUBLIC_GAME_URL

RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]