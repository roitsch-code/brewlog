import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __brewlogPgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

const pool = global.__brewlogPgPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  global.__brewlogPgPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
