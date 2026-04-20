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

function getPool(): Pool {
  if (global.__brewlogPgPool) return global.__brewlogPgPool;
  const pool = createPool();
  if (process.env.NODE_ENV !== "production") {
    global.__brewlogPgPool = pool;
  } else {
    global.__brewlogPgPool = pool;
  }
  return pool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (global.__brewlogDb) return global.__brewlogDb;
  const instance = drizzle(getPool(), { schema });
  global.__brewlogDb = instance;
  return instance;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool() as object, prop, receiver);
  },
});
