import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Health Check Endpoint
 * Verifies critical monitoring endpoints are accessible
 */

test.describe("Health Check", () => {
  test("should return healthy status", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toMatch(/healthy|degraded/);
    expect(body.checks).toBeDefined();
    expect(body.responseTime).toBeGreaterThan(0);
  });

  test("should check database", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    const dbCheck = body.checks.find(
      (c: { name: string }) => c.name === "database"
    );
    expect(dbCheck).toBeDefined();
    expect(dbCheck.status).toBe("healthy");
  });
});
