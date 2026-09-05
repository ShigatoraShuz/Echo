FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY packages/service-core/package.json packages/service-core/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/assessment-service/package.json services/assessment-service/package.json
COPY services/insights-service/package.json services/insights-service/package.json
COPY services/journal-service/package.json services/journal-service/package.json
COPY services/recommendation-service/package.json services/recommendation-service/package.json
COPY services/user-service/package.json services/user-service/package.json
COPY services/wellness-service/package.json services/wellness-service/package.json
RUN npm ci --workspace echo-theme-system

FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ARG NEXT_PUBLIC_DATA_ADAPTER=http
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_ENABLE_BUDDY=true
ARG NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
ARG NEXT_PUBLIC_ENABLE_DATA_EXPORT=true
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_DATA_ADAPTER=$NEXT_PUBLIC_DATA_ADAPTER \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_ENABLE_BUDDY=$NEXT_PUBLIC_ENABLE_BUDDY \
    NEXT_PUBLIC_ENABLE_NOTIFICATIONS=$NEXT_PUBLIC_ENABLE_NOTIFICATIONS \
    NEXT_PUBLIC_ENABLE_DATA_EXPORT=$NEXT_PUBLIC_ENABLE_DATA_EXPORT
COPY --from=dependencies /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY frontend frontend
RUN npm run build --workspace echo-theme-system

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/package.json ./frontend/package.json
USER node
EXPOSE 3000
WORKDIR /app/frontend
CMD ["npm", "run", "start"]
