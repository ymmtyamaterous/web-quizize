import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";

const MIGRATIONS_FOLDER =
  process.env.MIGRATIONS_FOLDER ?? "./packages/db/src/migrations";

export async function runMigrations() {
  console.log(`[DB] Running migrations from: ${MIGRATIONS_FOLDER}`);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("[DB] Migrations applied successfully");
}
