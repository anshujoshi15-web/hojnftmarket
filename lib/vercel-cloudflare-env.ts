import path from "node:path";
import { createLocalMarketplaceDb } from "./local-marketplace-db";
import { createRemoteMarketplaceDb } from "./remote-marketplace-db";
import type { D1Database } from "./marketplace-index";

let database: D1Database | undefined;
export const env = new Proxy(process.env as Record<string, unknown>, {
  get(target, property) {
    if (property !== "DB") return target[property as string];
    if (process.env.TURSO_DATABASE_URL) {
      database ??= createRemoteMarketplaceDb(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN ?? "");
      return database;
    }
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return undefined;
    database ??= createLocalMarketplaceDb(process.env.MARKETPLACE_DB_PATH || path.join(process.cwd(), ".data", "marketplace.sqlite"));
    return database;
  },
});
