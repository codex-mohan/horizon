import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL || "postgres://horizon:horizon@localhost:5432/horizon";

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
