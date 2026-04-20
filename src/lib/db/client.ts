import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __brewlogPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __brewlogDb: NodePgDatabase<typeof schema> | undefined;
}

function getPool(): Pool {
  if (global.__brewlogPgPool) return global.__brewlogPgPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  global.__brewlogPgPool = pool;
  return pool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (global.__brewlogDb) return global.__brewlogDb;
  const instance = drizzle(getPool(), { schema });
  global.__brewlogDb = instance;
  return instance;
}

// During `next build`, Next.js loads route files to extract metadata. DATABASE_URL
// isn't available in the build container, so we defer actual DB initialization
// until the first query at runtime. A Proxy wraps the real db instance and
// delegates every call to it — this preserves `this` binding for Drizzle's
// internal methods.
export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_target, prop) {
      const real = getDb() as unknown as Record<string | symbol, unknown>;
      const value = real[prop];
      if (typeof value === "function") {
        return value.bind(real);
      }
      return value;
    },
  },
);

export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    if (typeof value === "function") {
      return value.bind(real);
    }
    return value;
  },
});
