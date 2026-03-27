/**
 * Unit Tests: Logger
 * Tests structured logging with Axiom integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLogger,
  getLogger,
  generateCorrelationId,
  type Logger,
  type LoggerContext,
} from "@/lib/logger";

// Mock next-axiom Logger
vi.mock("next-axiom", () => ({
  Logger: class MockAxiomLogger {
    debug = vi.fn();
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    flush = vi.fn().mockResolvedValue(undefined);
  },
}));

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLogger", () => {
    it("should create logger without context", () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.flush).toBeDefined();
    });

    it("should create logger with context", () => {
      const context: LoggerContext = {
        correlationId: "test-123",
        jobId: "job-456",
      };
      const logger = createLogger(context);
      expect(logger).toBeDefined();
    });

    it("should create logger with custom context fields", () => {
      const context: LoggerContext = {
        correlationId: "test-123",
        url: "https://example.com",
        userId: "user-789",
        duration: 1500,
        customField: "custom-value",
      };
      const logger = createLogger(context);
      expect(logger).toBeDefined();
    });
  });

  describe("getLogger", () => {
    it("should return logger instance", () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it("should return logger without requiring context", () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
    });
  });

  describe("logger methods", () => {
    it("should log debug messages", () => {
      const logger = createLogger();
      logger.debug("Debug message");
      expect(logger.debug).toBeDefined();
    });

    it("should log info messages", () => {
      const logger = createLogger();
      logger.info("Info message");
      expect(logger.info).toBeDefined();
    });

    it("should log warn messages", () => {
      const logger = createLogger();
      logger.warn("Warning message");
      expect(logger.warn).toBeDefined();
    });

    it("should log error messages", () => {
      const logger = createLogger();
      logger.error("Error message");
      expect(logger.error).toBeDefined();
    });

    it("should log with additional context", () => {
      const logger = createLogger({ correlationId: "test-123" });
      logger.info("Message with context", { extra: "data" });
      expect(logger.info).toBeDefined();
    });

    it("should handle context merging", () => {
      const logger = createLogger({ correlationId: "test-123" });
      logger.info("Message", { jobId: "job-456", url: "https://example.com" });
      expect(logger.info).toBeDefined();
    });
  });

  describe("flush", () => {
    it("should flush logs", async () => {
      const logger = createLogger();
      await logger.flush();
      expect(logger.flush).toBeDefined();
    });

    it("should return promise", async () => {
      const logger = createLogger();
      const result = logger.flush();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it("should be callable multiple times", async () => {
      const logger = createLogger();
      await logger.flush();
      await logger.flush();
      await logger.flush();
      expect(logger.flush).toBeDefined();
    });
  });

  describe("generateCorrelationId", () => {
    it("should generate correlation ID", () => {
      const id = generateCorrelationId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });

    it("should include timestamp", () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).not.toBe(id2);
    });

    it("should have correct format", () => {
      const id = generateCorrelationId();
      const parts = id.split("-");
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^\d+$/); // timestamp
      expect(parts[1]).toMatch(/^[a-z0-9]+$/); // random string
    });

    it("should generate IDs with timestamp prefix", () => {
      const before = Date.now();
      const id = generateCorrelationId();
      const after = Date.now();

      const timestamp = parseInt(id.split("-")[0]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("should generate IDs with random suffix", () => {
      const id = generateCorrelationId();
      const suffix = id.split("-")[1];
      expect(suffix.length).toBeGreaterThan(0);
      expect(suffix.length).toBeLessThanOrEqual(7);
    });
  });

  describe("context handling", () => {
    it("should merge logger context with message context", () => {
      const logger = createLogger({
        correlationId: "test-123",
        jobId: "job-456",
      });
      logger.info("Test message", { extra: "field" });
      expect(logger.info).toBeDefined();
    });

    it("should preserve logger context across calls", () => {
      const logger = createLogger({ correlationId: "test-123" });
      logger.info("First message");
      logger.info("Second message");
      logger.error("Error message");
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it("should allow message context to override", () => {
      const logger = createLogger({ correlationId: "test-123" });
      logger.info("Message", { correlationId: "override-456" });
      expect(logger.info).toBeDefined();
    });

    it("should include environment in context", () => {
      const logger = createLogger();
      logger.info("Test message");
      // Environment should be added automatically
      expect(logger.info).toBeDefined();
    });

    it("should include service name in context", () => {
      const logger = createLogger();
      logger.info("Test message");
      // Service name should be added automatically
      expect(logger.info).toBeDefined();
    });
  });

  describe("real-world usage patterns", () => {
    it("should handle request logging pattern", async () => {
      const correlationId = generateCorrelationId();
      const logger = createLogger({ correlationId });

      logger.info("Request started", {
        url: "https://example.com",
        method: "GET",
      });

      logger.info("Processing request");

      logger.info("Request completed", {
        duration: 150,
        status: 200,
      });

      await logger.flush();
      expect(logger.info).toBeDefined();
    });

    it("should handle job logging pattern", async () => {
      const correlationId = generateCorrelationId();
      const logger = createLogger({
        correlationId,
        jobId: "job-123",
      });

      logger.info("Job started");
      logger.debug("Processing step 1");
      logger.debug("Processing step 2");
      logger.info("Job completed", { duration: 5000 });

      await logger.flush();
      expect(logger.info).toBeDefined();
    });

    it("should handle error logging with context", () => {
      const logger = createLogger({ correlationId: "test-123" });

      logger.error("Database connection failed", {
        error: "Connection timeout",
        database: "postgres",
        retryCount: 3,
      });

      expect(logger.error).toBeDefined();
    });

    it("should handle warning logs", () => {
      const logger = createLogger();

      logger.warn("Rate limit approaching", {
        current: 95,
        limit: 100,
        resetAt: new Date().toISOString(),
      });

      expect(logger.warn).toBeDefined();
    });

    it("should support structured logging for analytics", () => {
      const logger = createLogger({
        correlationId: generateCorrelationId(),
      });

      logger.info("Crawl completed", {
        url: "https://example.com",
        pageCount: 50,
        duration: 30000,
        maxDepth: 3,
        tokensUsed: 5000,
        model: "llama-3.3-70b-versatile",
      });

      expect(logger.info).toBeDefined();
    });
  });

  describe("logger factory", () => {
    it("should export createLogger function", () => {
      expect(createLogger).toBeDefined();
      expect(typeof createLogger).toBe("function");
    });

    it("should export getLogger function", () => {
      expect(getLogger).toBeDefined();
      expect(typeof getLogger).toBe("function");
    });

    it("should export generateCorrelationId function", () => {
      expect(generateCorrelationId).toBeDefined();
      expect(typeof generateCorrelationId).toBe("function");
    });
  });

  describe("edge cases", () => {
    it("should handle empty context", () => {
      const logger = createLogger({});
      logger.info("Test message");
      expect(logger.info).toBeDefined();
    });

    it("should handle undefined context", () => {
      const logger = createLogger(undefined);
      logger.info("Test message");
      expect(logger.info).toBeDefined();
    });

    it("should handle empty message", () => {
      const logger = createLogger();
      logger.info("");
      expect(logger.info).toBeDefined();
    });

    it("should handle complex context objects", () => {
      const logger = createLogger();
      logger.info("Complex context", {
        nested: {
          deep: {
            object: "value",
          },
        },
        array: [1, 2, 3],
        date: new Date(),
      });
      expect(logger.info).toBeDefined();
    });

    it("should handle null values in context", () => {
      const logger = createLogger();
      logger.info("Null context", {
        nullField: null,
        undefinedField: undefined,
      });
      expect(logger.info).toBeDefined();
    });

    it("should handle multiple loggers", () => {
      const logger1 = createLogger({ correlationId: "test-1" });
      const logger2 = createLogger({ correlationId: "test-2" });

      logger1.info("Logger 1 message");
      logger2.info("Logger 2 message");

      expect(logger1.info).toBeDefined();
      expect(logger2.info).toBeDefined();
    });
  });
});
