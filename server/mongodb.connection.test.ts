import "dotenv/config";
import { describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";

describe("MongoDB connection secret", () => {
  it.skipIf(process.env.RUN_MONGODB_TEST !== "1")(
    "pings MongoDB when the URI is configured",
    async () => {
    const uri = process.env.MONGODB_URI;
    expect(uri, "MONGODB_URI must be configured").toBeTruthy();
    const client = new MongoClient(uri!, { serverSelectionTimeoutMS: 15000 });
    try {
      await client.db("admin").command({ ping: 1 });
      expect(true).toBe(true);
    } finally {
      await client.close();
    }
    },
    20000
  );
});
