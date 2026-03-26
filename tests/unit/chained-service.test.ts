import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createChainedService,
  IChainable,
} from "@/lib/content-generation/strategies/chained-service";

// Mock service interface for testing
interface ITestService extends IChainable {
  process(input: string): Promise<string>;
  transform(value: number): Promise<number>;
}

describe("createChainedService", () => {
  let primaryService: ITestService;
  let fallbackService: ITestService;
  let alwaysAvailableService: ITestService;

  beforeEach(() => {
    vi.clearAllMocks();

    primaryService = {
      isAvailable: vi.fn().mockReturnValue(true),
      process: vi.fn().mockResolvedValue("primary-result"),
      transform: vi.fn().mockResolvedValue(100),
    };

    fallbackService = {
      isAvailable: vi.fn().mockReturnValue(true),
      process: vi.fn().mockResolvedValue("fallback-result"),
      transform: vi.fn().mockResolvedValue(200),
    };

    alwaysAvailableService = {
      isAvailable: vi.fn().mockReturnValue(true),
      process: vi.fn().mockResolvedValue("always-available-result"),
      transform: vi.fn().mockResolvedValue(300),
    };
  });

  describe("constructor", () => {
    it("should create chained service with single service", () => {
      const chained = createChainedService([primaryService]);
      expect(chained).toBeDefined();
    });

    it("should create chained service with multiple services", () => {
      const chained = createChainedService([primaryService, fallbackService]);
      expect(chained).toBeDefined();
    });

    it("should throw error with empty service array", () => {
      expect(() => createChainedService([])).toThrow(
        /Cannot create chained service with empty array/
      );
    });

    it("should accept service name option", () => {
      const chained = createChainedService([primaryService], {
        serviceName: "TestService",
      });
      expect(chained).toBeDefined();
    });

    it("should accept throwOnAllFailed option", () => {
      const chained = createChainedService([primaryService], {
        throwOnAllFailed: false,
      });
      expect(chained).toBeDefined();
    });
  });

  describe("isAvailable", () => {
    it("should return true when at least one service is available", () => {
      primaryService.isAvailable = vi.fn().mockReturnValue(false);
      fallbackService.isAvailable = vi.fn().mockReturnValue(true);

      const chained = createChainedService([primaryService, fallbackService]);

      expect(chained.isAvailable()).toBe(true);
    });

    it("should return false when all services are unavailable", () => {
      primaryService.isAvailable = vi.fn().mockReturnValue(false);
      fallbackService.isAvailable = vi.fn().mockReturnValue(false);

      const chained = createChainedService([primaryService, fallbackService]);

      expect(chained.isAvailable()).toBe(false);
    });

    it("should return true when first service is available", () => {
      const chained = createChainedService([primaryService, fallbackService]);

      expect(chained.isAvailable()).toBe(true);
    });
  });

  describe("method delegation", () => {
    it("should call first available service", async () => {
      const chained = createChainedService([primaryService, fallbackService]);

      const result = await chained.process("test-input");

      expect(result).toBe("primary-result");
      expect(primaryService.process).toHaveBeenCalledWith("test-input");
      expect(fallbackService.process).not.toHaveBeenCalled();
    });

    it("should fallback to second service on error", async () => {
      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));

      const chained = createChainedService([primaryService, fallbackService]);

      const result = await chained.process("test-input");

      expect(result).toBe("fallback-result");
      expect(primaryService.process).toHaveBeenCalledWith("test-input");
      expect(fallbackService.process).toHaveBeenCalledWith("test-input");
    });

    it("should try all services in order", async () => {
      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));
      fallbackService.process = vi
        .fn()
        .mockRejectedValue(new Error("Fallback failed"));

      const chained = createChainedService([
        primaryService,
        fallbackService,
        alwaysAvailableService,
      ]);

      const result = await chained.process("test-input");

      expect(result).toBe("always-available-result");
      expect(primaryService.process).toHaveBeenCalled();
      expect(fallbackService.process).toHaveBeenCalled();
      expect(alwaysAvailableService.process).toHaveBeenCalled();
    });

    it("should skip unavailable services", async () => {
      primaryService.isAvailable = vi.fn().mockReturnValue(false);

      const chained = createChainedService([primaryService, fallbackService]);

      const result = await chained.process("test-input");

      expect(result).toBe("fallback-result");
      expect(primaryService.process).not.toHaveBeenCalled();
      expect(fallbackService.process).toHaveBeenCalledWith("test-input");
    });

    it("should throw error when all services fail", async () => {
      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));
      fallbackService.process = vi
        .fn()
        .mockRejectedValue(new Error("Fallback failed"));

      const chained = createChainedService([primaryService, fallbackService], {
        throwOnAllFailed: true,
      });

      await expect(chained.process("test-input")).rejects.toThrow(
        /All services failed/
      );
    });

    it("should return undefined when all services fail and throwOnAllFailed is false", async () => {
      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));
      fallbackService.process = vi
        .fn()
        .mockRejectedValue(new Error("Fallback failed"));

      const chained = createChainedService([primaryService, fallbackService], {
        throwOnAllFailed: false,
      });

      const result = await chained.process("test-input");

      expect(result).toBeUndefined();
    });

    it("should handle multiple different methods", async () => {
      const chained = createChainedService([primaryService, fallbackService]);

      const processResult = await chained.process("test");
      const transformResult = await chained.transform(42);

      expect(processResult).toBe("primary-result");
      expect(transformResult).toBe(100);
      expect(primaryService.process).toHaveBeenCalledWith("test");
      expect(primaryService.transform).toHaveBeenCalledWith(42);
    });

    it("should pass all arguments to service method", async () => {
      interface IMultiArgService extends IChainable {
        calculate(a: number, b: number, c: string): Promise<string>;
      }

      const multiArgService: IMultiArgService = {
        isAvailable: () => true,
        calculate: vi.fn().mockResolvedValue("calculated"),
      };

      const chained = createChainedService([multiArgService]);

      await chained.calculate(1, 2, "test");

      expect(multiArgService.calculate).toHaveBeenCalledWith(1, 2, "test");
    });

    it("should throw error if method does not exist on service", async () => {
      const invalidService = {
        isAvailable: () => true,
        // Missing 'process' method
      } as unknown as ITestService;

      const chained = createChainedService([invalidService]);

      await expect(chained.process("test")).rejects.toThrow(
        /Method process not found/
      );
    });
  });

  describe("error handling", () => {
    it("should include service name in error messages", async () => {
      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));
      fallbackService.process = vi
        .fn()
        .mockRejectedValue(new Error("Fallback failed"));

      const chained = createChainedService([primaryService, fallbackService], {
        serviceName: "TestService",
      });

      await expect(chained.process("test")).rejects.toThrow(/TestService/);
    });

    it("should include method name in error messages", async () => {
      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));

      const chained = createChainedService([primaryService], {
        serviceName: "TestService",
      });

      await expect(chained.process("test")).rejects.toThrow(/process/);
    });

    it("should list all failures in error message", async () => {
      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));
      fallbackService.process = vi
        .fn()
        .mockRejectedValue(new Error("Fallback failed"));

      const chained = createChainedService([primaryService, fallbackService]);

      await expect(chained.process("test")).rejects.toThrow(/Primary failed/);
      await expect(chained.process("test")).rejects.toThrow(/Fallback failed/);
    });
  });

  describe("logging behavior", () => {
    it("should log when fallback succeeds after primary failure", async () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));

      const chained = createChainedService([primaryService, fallbackService], {
        serviceName: "TestService",
      });

      await chained.process("test");

      expect(warnSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should log warning for each failed service", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      primaryService.process = vi
        .fn()
        .mockRejectedValue(new Error("Primary failed"));
      fallbackService.process = vi
        .fn()
        .mockRejectedValue(new Error("Fallback failed"));

      const chained = createChainedService([
        primaryService,
        fallbackService,
        alwaysAvailableService,
      ]);

      await chained.process("test");

      expect(warnSpy).toHaveBeenCalledTimes(2); // 2 failures before success

      warnSpy.mockRestore();
    });
  });

  describe("real-world scenarios", () => {
    it("should handle AI service with heuristic fallback", async () => {
      const aiService: ITestService = {
        isAvailable: () => true,
        process: vi.fn().mockRejectedValue(new Error("Rate limit exceeded")),
        transform: vi.fn(),
      };

      const heuristicService: ITestService = {
        isAvailable: () => true,
        process: vi.fn().mockResolvedValue("heuristic-result"),
        transform: vi.fn(),
      };

      const chained = createChainedService([aiService, heuristicService], {
        serviceName: "DescriptionGenerator",
      });

      const result = await chained.process("generate description");

      expect(result).toBe("heuristic-result");
    });

    it("should handle multiple AI providers with fallback", async () => {
      const groqService: ITestService = {
        isAvailable: () => true,
        process: vi.fn().mockRejectedValue(new Error("Groq unavailable")),
        transform: vi.fn(),
      };

      const claudeService: ITestService = {
        isAvailable: () => true,
        process: vi.fn().mockResolvedValue("claude-result"),
        transform: vi.fn(),
      };

      const heuristicService: ITestService = {
        isAvailable: () => true,
        process: vi.fn().mockResolvedValue("heuristic-result"),
        transform: vi.fn(),
      };

      const chained = createChainedService(
        [groqService, claudeService, heuristicService],
        { serviceName: "DescriptionGenerator" }
      );

      const result = await chained.process("test");

      expect(result).toBe("claude-result");
      expect(groqService.process).toHaveBeenCalled();
      expect(claudeService.process).toHaveBeenCalled();
      expect(heuristicService.process).not.toHaveBeenCalled();
    });

    it("should handle service that becomes unavailable", async () => {
      let isAvailable = true;
      const volatileService: ITestService = {
        isAvailable: () => isAvailable,
        process: vi.fn().mockResolvedValue("volatile-result"),
        transform: vi.fn(),
      };

      const stableService: ITestService = {
        isAvailable: () => true,
        process: vi.fn().mockResolvedValue("stable-result"),
        transform: vi.fn(),
      };

      const chained = createChainedService([volatileService, stableService]);

      // First call: volatile service is available
      let result = await chained.process("test1");
      expect(result).toBe("volatile-result");

      // Service becomes unavailable
      isAvailable = false;

      // Second call: should skip to stable service
      result = await chained.process("test2");
      expect(result).toBe("stable-result");
    });
  });
});
