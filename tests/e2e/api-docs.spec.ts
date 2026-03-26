import { test, expect } from "@playwright/test";

/**
 * E2E Tests: API Documentation
 * Verifies API documentation endpoints are accessible and return correct format
 */

test.describe("API Documentation", () => {
  test("should return API root documentation", async ({ request }) => {
    const response = await request.get("/api");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("llms.txt Generator API");
    expect(body.version).toBe("1.0.0");
    expect(body.endpoints).toBeDefined();
    expect(body.apiFeatures).toBeDefined();
  });

  test("should return v1 documentation", async ({ request }) => {
    const response = await request.get("/api/v1");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.version).toBe("1");
    expect(body.resources).toBeDefined();
    expect(body.resources.llmsTxt).toBeDefined();
  });

  test("should include correlation ID in response headers", async ({
    request,
  }) => {
    const response = await request.get("/api");

    const correlationId = response.headers()["x-correlation-id"];
    expect(correlationId).toBeDefined();
    expect(correlationId.length).toBeGreaterThan(0);
  });
});
