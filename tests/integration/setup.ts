/**
 * Integration Test Setup
 * Uses Docker PostgreSQL for realistic testing
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { beforeAll, afterAll, afterEach } from "vitest";

// Use production db singleton (senior approach)
// Tests real production code path with environment-specific DATABASE_URL
// - Local: reads from .env → Docker PostgreSQL (localhost:5433)
// - CI: reads from GitHub Actions env → PostgreSQL service container
// - Production: reads from Vercel env → Neon database
export const testDb = db;

/**
 * Setup test database connection
 */
export async function setupTestDb() {
  await testDb.$connect();

  // Verify connection works
  await testDb.$queryRaw`SELECT 1`;

  console.log(
    "✅ Test database connected:",
    process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")
  );
}

/**
 * Teardown test database connection
 */
export async function teardownTestDb() {
  await testDb.$disconnect();
}

/**
 * Clear all data between tests
 * Uses TRUNCATE for speed (Prisma recommendation)
 */
export async function clearDatabase() {
  // TRUNCATE is faster than deleteMany and handles FK constraints with CASCADE
  await testDb.$executeRawUnsafe(
    'TRUNCATE TABLE "crawl_jobs" RESTART IDENTITY CASCADE'
  );
}

/**
 * Create test job
 */
export async function createTestJob(
  data?: Partial<{
    url: string;
    status: string;
    result: string | null;
    error: string | null;
  }>
) {
  return testDb.crawlJob.create({
    data: {
      url: data?.url || "https://example.com",
      status:
        (data?.status as "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED") ||
        "PENDING",
      ...(data?.result !== undefined && {
        result: data.result === null ? Prisma.JsonNull : data.result,
      }),
      ...(data?.error !== undefined && { error: data.error }),
    },
  });
}

/**
 * Vitest global setup
 * Following Prisma recommendations for integration testing:
 * - Setup in beforeAll
 * - Cleanup after each test with TRUNCATE
 * - Use TRUNCATE for fast cleanup (handles FK constraints)
 */
beforeAll(async () => {
  await setupTestDb();
  // Clear any existing data from previous runs
  await clearDatabase();
});

afterAll(async () => {
  // Clean up test data
  await clearDatabase();
  await teardownTestDb();
});

// Clear data between tests to ensure isolation
afterEach(async () => {
  await clearDatabase();
});
