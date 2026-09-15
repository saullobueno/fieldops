import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://fieldops:fieldops@localhost:5432/fieldops"
  },
  strict: true,
  verbose: true
});
