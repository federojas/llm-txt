import { describe, it, expect } from "vitest";
import {
  ValidationError,
  NotFoundError,
  InternalServerError,
  BadRequestError,
  TimeoutError,
  RateLimitError,
} from "@/lib/api";

describe("API Error Classes", () => {
  describe("ValidationError", () => {
    it("should create a validation error with correct properties", () => {
      const error = new ValidationError("Invalid input");

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
    });

    it("should include details when provided", () => {
      const details = { field: "url", issue: "required" };
      const error = new ValidationError("Invalid input", details);

      expect(error.details).toEqual(details);
    });
  });

  describe("NotFoundError", () => {
    it("should create a not found error with correct properties", () => {
      const error = new NotFoundError("Resource not found");

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("InternalServerError", () => {
    it("should create an internal server error with correct properties", () => {
      const error = new InternalServerError("Something went wrong");

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("BadRequestError", () => {
    it("should create a bad request error with correct properties", () => {
      const error = new BadRequestError("Bad request");

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("BAD_REQUEST");
    });
  });

  describe("TimeoutError", () => {
    it("should create a timeout error with correct properties", () => {
      const error = new TimeoutError("Request timeout");

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(408);
      expect(error.code).toBe("TIMEOUT");
    });
  });

  describe("RateLimitError", () => {
    it("should create a rate limit error with correct properties", () => {
      const error = new RateLimitError("Too many requests");

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
