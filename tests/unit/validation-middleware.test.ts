/**
 * Unit Tests: Request Validation Middleware
 * Tests Zod schema validation for API requests
 */

import { describe, it, expect, vi } from "vitest";
import { validateRequest, validate } from "@/lib/api/middleware/validation";
import { ValidationError } from "@/lib/api";
import { z } from "zod";
import { NextRequest } from "next/server";

describe("Validation Middleware", () => {
  describe("validateRequest", () => {
    it("should validate valid request body", async () => {
      const schema = z.object({
        url: z.string().url(),
        maxPages: z.number().int().positive(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          url: "https://example.com",
          maxPages: 50,
        }),
      } as unknown as NextRequest;

      const result = await validateRequest(mockRequest, schema);

      expect(result).toEqual({
        url: "https://example.com",
        maxPages: 50,
      });
    });

    it("should throw ValidationError for invalid data", async () => {
      const schema = z.object({
        url: z.string().url(),
        maxPages: z.number().int().positive(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          url: "not-a-url",
          maxPages: -5,
        }),
      } as unknown as NextRequest;

      await expect(validateRequest(mockRequest, schema)).rejects.toThrow(
        ValidationError
      );
    });

    it("should include Zod issues in ValidationError", async () => {
      const schema = z.object({
        url: z.string().url(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          url: "invalid-url",
        }),
      } as unknown as NextRequest;

      try {
        await validateRequest(mockRequest, schema);
        expect.fail("Should have thrown ValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.details).toBeDefined();
          expect(error.details).not.toHaveLength(0);
        }
      }
    });

    it("should validate request with multiple fields", async () => {
      const schema = z.object({
        url: z.string().url(),
        maxPages: z.number().int().positive().optional(),
        maxDepth: z.number().int().positive().optional(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          url: "https://example.com",
          maxPages: 100,
          maxDepth: 3,
        }),
      } as unknown as NextRequest;

      const result = await validateRequest(mockRequest, schema);

      expect(result.url).toBe("https://example.com");
      expect(result.maxPages).toBe(100);
      expect(result.maxDepth).toBe(3);
    });

    it("should validate request with optional fields omitted", async () => {
      const schema = z.object({
        url: z.string().url(),
        maxPages: z.number().int().positive().optional(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          url: "https://example.com",
        }),
      } as unknown as NextRequest;

      const result = await validateRequest(mockRequest, schema);

      expect(result.url).toBe("https://example.com");
      expect(result.maxPages).toBeUndefined();
    });

    it("should handle missing required fields", async () => {
      const schema = z.object({
        url: z.string().url(),
        maxPages: z.number(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          url: "https://example.com",
          // maxPages is missing
        }),
      } as unknown as NextRequest;

      await expect(validateRequest(mockRequest, schema)).rejects.toThrow(
        ValidationError
      );
    });

    it("should handle invalid JSON", async () => {
      const schema = z.object({
        url: z.string(),
      });

      const mockRequest = {
        json: vi.fn().mockRejectedValue(new SyntaxError("Invalid JSON")),
      } as unknown as NextRequest;

      await expect(validateRequest(mockRequest, schema)).rejects.toThrow(
        SyntaxError
      );
    });

    it("should validate complex nested schemas", async () => {
      const schema = z.object({
        url: z.string().url(),
        options: z.object({
          maxPages: z.number(),
          maxDepth: z.number(),
        }),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          url: "https://example.com",
          options: {
            maxPages: 50,
            maxDepth: 3,
          },
        }),
      } as unknown as NextRequest;

      const result = await validateRequest(mockRequest, schema);

      expect(result.url).toBe("https://example.com");
      expect(result.options.maxPages).toBe(50);
      expect(result.options.maxDepth).toBe(3);
    });

    it("should validate arrays", async () => {
      const schema = z.object({
        urls: z.array(z.string().url()),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          urls: ["https://example.com", "https://test.com"],
        }),
      } as unknown as NextRequest;

      const result = await validateRequest(mockRequest, schema);

      expect(result.urls).toHaveLength(2);
      expect(result.urls[0]).toBe("https://example.com");
    });

    it("should reject invalid array items", async () => {
      const schema = z.object({
        urls: z.array(z.string().url()),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          urls: ["https://example.com", "not-a-url"],
        }),
      } as unknown as NextRequest;

      await expect(validateRequest(mockRequest, schema)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("validate", () => {
    it("should validate valid data", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validate(
        {
          name: "John",
          age: 30,
        },
        schema
      );

      expect(result).toEqual({
        name: "John",
        age: 30,
      });
    });

    it("should throw ValidationError for invalid data", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      expect(() =>
        validate(
          {
            name: "John",
            age: "thirty", // Should be number
          },
          schema
        )
      ).toThrow(ValidationError);
    });

    it("should include Zod issues in ValidationError", () => {
      const schema = z.object({
        url: z.string().url(),
      });

      try {
        validate({ url: "not-a-url" }, schema);
        expect.fail("Should have thrown ValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.details).toBeDefined();
          expect(error.details).not.toHaveLength(0);
        }
      }
    });

    it("should validate data with optional fields", () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email().optional(),
      });

      const result = validate({ name: "John" }, schema);

      expect(result.name).toBe("John");
      expect(result.email).toBeUndefined();
    });

    it("should validate data with default values", () => {
      const schema = z.object({
        name: z.string(),
        role: z.string().default("user"),
      });

      const result = validate({ name: "John" }, schema);

      expect(result.name).toBe("John");
      expect(result.role).toBe("user");
    });

    it("should handle missing required fields", () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      expect(() => validate({ name: "John" }, schema)).toThrow(ValidationError);
    });

    it("should strip extra fields with strict mode", () => {
      const schema = z
        .object({
          name: z.string(),
          age: z.number(),
        })
        .strict();

      expect(() =>
        validate(
          {
            name: "John",
            age: 30,
            extra: "field",
          },
          schema
        )
      ).toThrow(ValidationError);
    });

    it("should allow extra fields without strict mode", () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = validate(
        {
          name: "John",
          extra: "field",
        },
        schema
      );

      expect(result.name).toBe("John");
    });

    it("should validate strings with constraints", () => {
      const schema = z.object({
        url: z.string().url(),
        email: z.string().email(),
        minLength: z.string().min(3),
        maxLength: z.string().max(10),
      });

      const result = validate(
        {
          url: "https://example.com",
          email: "test@example.com",
          minLength: "abc",
          maxLength: "short",
        },
        schema
      );

      expect(result.url).toBe("https://example.com");
      expect(result.email).toBe("test@example.com");
    });

    it("should validate numbers with constraints", () => {
      const schema = z.object({
        positive: z.number().positive(),
        min: z.number().min(10),
        max: z.number().max(100),
        integer: z.number().int(),
      });

      const result = validate(
        {
          positive: 5,
          min: 20,
          max: 50,
          integer: 42,
        },
        schema
      );

      expect(result.positive).toBe(5);
      expect(result.min).toBe(20);
      expect(result.max).toBe(50);
      expect(result.integer).toBe(42);
    });

    it("should validate enums", () => {
      const schema = z.object({
        status: z.enum(["pending", "active", "completed"]),
      });

      const result = validate({ status: "active" }, schema);

      expect(result.status).toBe("active");
    });

    it("should reject invalid enum values", () => {
      const schema = z.object({
        status: z.enum(["pending", "active", "completed"]),
      });

      expect(() => validate({ status: "invalid" }, schema)).toThrow(
        ValidationError
      );
    });

    it("should validate unions", () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      const result1 = validate({ value: "text" }, schema);
      expect(result1.value).toBe("text");

      const result2 = validate({ value: 123 }, schema);
      expect(result2.value).toBe(123);
    });

    it("should transform data", () => {
      const schema = z.object({
        value: z.string().transform((val) => val.toUpperCase()),
      });

      const result = validate({ value: "hello" }, schema);

      expect(result.value).toBe("HELLO");
    });

    it("should validate dates", () => {
      const schema = z.object({
        date: z.string().datetime(),
      });

      const result = validate({ date: "2024-01-01T00:00:00Z" }, schema);

      expect(result.date).toBe("2024-01-01T00:00:00Z");
    });

    it("should validate complex nested structures", () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          address: z.object({
            city: z.string(),
            country: z.string(),
          }),
        }),
      });

      const result = validate(
        {
          user: {
            name: "John",
            address: {
              city: "NYC",
              country: "USA",
            },
          },
        },
        schema
      );

      expect(result.user.name).toBe("John");
      expect(result.user.address.city).toBe("NYC");
    });

    it("should rethrow non-ZodError errors", () => {
      const schema = z.object({
        name: z.string(),
      });

      // Create a schema that throws a non-ZodError
      const throwingSchema = schema.refine(() => {
        throw new Error("Custom error");
      });

      expect(() => validate({ name: "John" }, throwingSchema)).toThrow(
        "Custom error"
      );
    });
  });

  describe("error messages", () => {
    it("should provide meaningful error messages for ValidationError", () => {
      const schema = z.object({
        url: z.string().url(),
        maxPages: z.number().positive(),
      });

      try {
        validate(
          {
            url: "invalid",
            maxPages: -5,
          },
          schema
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.message).toBe("Invalid data");
        }
      }
    });

    it("should include all validation issues", () => {
      const schema = z.object({
        url: z.string().url(),
        email: z.string().email(),
        age: z.number().positive(),
      });

      try {
        validate(
          {
            url: "not-url",
            email: "not-email",
            age: -5,
          },
          schema
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(Array.isArray(error.details)).toBe(true);
          expect(
            (error.details as Array<unknown>).length
          ).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });
});
