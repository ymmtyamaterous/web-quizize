import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";

const MIGRATIONS_FOLDER =
  process.env.MIGRATIONS_FOLDER ??
  path.join(import.meta.dirname, "migrations");

export async function runMigrations() {
  console.log(`[DB] Running migrations from: ${MIGRATIONS_FOLDER}`);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("[DB] Migrations applied successfully");
}
