# ECHO backend container.
# Build context MUST be the repository root (workspaces are installed from the
# root lockfile):
#   docker build -f backend/Dockerfile -t echo-backend .
# Runtime secrets are injected via an .env file mounted at /app/.env
# (see --env-file-if-exists below); the image itself must never contain them.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --omit=dev
COPY backend ./backend
RUN npm run build -w backend

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/package.json ./package.json
EXPOSE 4000
CMD ["node", "--env-file-if-exists=.env", "backend/dist/server.js"]
