import { db } from "@/lib/db/client";
import { places } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(places).orderBy(asc(places.city), asc(places.name));
  return Response.json(rows);
}
