import { createOwnedDatabase, env, listen, positiveIntegerEnv, secretEnv } from "@echo/service-core";
import { createRecommendationApp } from "./app.js";
import { RecommendationService } from "./recommendation.service.js";

const database = createOwnedDatabase({
  url: env("SUPABASE_URL"),
  key: env("SUPABASE_DATABASE_KEY"),
  tables: ["support_resources"],
});
const port = positiveIntegerEnv("PORT", 4205);
listen(
  createRecommendationApp(new RecommendationService(database), secretEnv("RECOMMENDATION_SERVICE_TOKEN")),
  { name: "recommendation-service", port },
);
