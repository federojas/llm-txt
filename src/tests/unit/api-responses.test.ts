import { describe, it, expect } from "vitest";
import { successResponse, errorResponse } from "@/lib/api";

describe("API Response Utilities", () => {
  describe("successResponse", () => {
    it("should create a success response with data", () => {
      const data = { message: "test" };
      const response = successResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toBeUndefined();
    });

    it("should create a success response with data and meta", () => {
      const data = { message: "test" };
      const meta = { timestamp: Date.now() };
      const response = successResponse(data, meta);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toEqual(meta);
    });
  });

  describe("errorResponse", () => {
    it("should create an error response with code and message", () => {
      const response = errorResponse("TEST_ERROR", "Test error message");

      expect(response.success).toBe(false);
      expect(response.error.code).toBe("TEST_ERROR");
      expect(response.error.message).toBe("Test error message");
      expect(response.error.details).toBeUndefined();
    });

    it("should create an error response with details", () => {
      const details = { field: "url", issue: "invalid" };
      const response = errorResponse(
        "VALIDATION_ERROR",
        "Invalid input",
        details
      );

      expect(response.success).toBe(false);
      expect(response.error.code).toBe("VALIDATION_ERROR");
      expect(response.error.message).toBe("Invalid input");
      expect(response.error.details).toEqual(details);
    });
  });
});
