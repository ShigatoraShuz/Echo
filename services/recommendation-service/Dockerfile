FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/service-core/package.json packages/service-core/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/assessment-service/package.json services/assessment-service/package.json
COPY services/insights-service/package.json services/insights-service/package.json
COPY services/journal-service/package.json services/journal-service/package.json
COPY services/recommendation-service/package.json services/recommendation-service/package.json
COPY services/user-service/package.json services/user-service/package.json
COPY services/wellness-service/package.json services/wellness-service/package.json
RUN npm ci --workspace @echo/recommendation-service --workspace @echo/service-core
COPY tsconfig.base.json ./
COPY packages/service-core packages/service-core
COPY services/recommendation-service services/recommendation-service
RUN npm run build --workspace @echo/recommendation-service
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/service-core ./packages/service-core
COPY --from=build /app/services/recommendation-service/dist ./services/recommendation-service/dist
COPY --from=build /app/services/recommendation-service/package.json ./services/recommendation-service/package.json
USER node
CMD ["node", "services/recommendation-service/dist/server.js"]
