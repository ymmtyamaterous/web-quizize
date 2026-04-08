import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SAKURA_AI_API_KEY: z.string().min(1),
    SAKURA_AI_API_BASE_URL: z.url(),
    SAKURA_AI_MODEL: z.string().min(1),
    AI_DAILY_REQUEST_LIMIT: z.coerce.number().int().min(1).default(10),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
