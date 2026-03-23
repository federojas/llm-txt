/**
 * Chain of Responsibility Pattern for AI Services
 * Creates a chained service that tries providers in order until one succeeds
 *
 * This implements graceful degradation: AI → Fallback AI → Heuristics
 * Works with any service interface that has isAvailable() method
 */

/**
 * Base requirement for chainable services
 */
export interface IChainable {
  isAvailable(): boolean;
}

/**
 * Options for chained service behavior
 */
export interface ChainedServiceOptions {
  /** Service name for logging (e.g., "DescriptionGenerator") */
  serviceName?: string;
  /** Whether to throw error if all services fail (default: true) */
  throwOnAllFailed?: boolean;
}

/**
 * Creates a chained service that tries providers in order until one succeeds
 *
 * @example
 * ```typescript
 * const generator = createChainedService<IDescriptionGenerator>([
 *   new GroqDescriptionGenerator(apiKey),      // Try AI first
 *   new ClaudeDescriptionGenerator(apiKey),     // Backup AI
 *   new HeuristicDescriptionGenerator()         // Always-available fallback
 * ], { serviceName: 'DescriptionGenerator' });
 *
 * // Use it like any other IDescriptionGenerator
 * const description = await generator.generateDescription(page);
 * ```
 *
 * @param services - Array of service implementations to try in order
 * @param options - Configuration options
 * @returns Proxy that implements the service interface with fallback behavior
 */
export function createChainedService<T extends IChainable>(
  services: T[],
  options?: ChainedServiceOptions
): T {
  const { serviceName = "Service", throwOnAllFailed = true } = options || {};

  if (services.length === 0) {
    throw new Error(
      `${serviceName}: Cannot create chained service with empty array`
    );
  }

  const handler: ProxyHandler<T> = {
    get(_target, prop: string | symbol) {
      // Handle isAvailable specially - returns true if ANY service is available
      if (prop === "isAvailable") {
        return () => services.some((s) => s.isAvailable());
      }

      // For all other methods, try each service in chain
      return async (...args: unknown[]) => {
        const failures: Array<{ service: string; error: unknown }> = [];

        for (const service of services) {
          // Skip unavailable services
          if (!service.isAvailable()) {
            continue;
          }

          try {
            const method = (service as Record<string | symbol, unknown>)[prop];
            if (typeof method !== "function") {
              throw new Error(
                `Method ${String(prop)} not found on ${service.constructor.name}`
              );
            }

            const result = await method.apply(service, args);

            // Success! Log if we had previous failures (indicates fallback kicked in)
            if (failures.length > 0) {
              console.info(
                `[${serviceName}.${String(prop)}] ` +
                  `Succeeded with ${service.constructor.name} ` +
                  `after ${failures.length} failure(s)`
              );
            }

            return result;
          } catch (error) {
            // Track failure and continue to next service
            failures.push({
              service: service.constructor.name,
              error,
            });

            console.warn(
              `[${serviceName}.${String(prop)}] ${service.constructor.name} failed:`,
              error instanceof Error ? error.message : String(error),
              "→ trying next service in chain"
            );
          }
        }

        // All services failed
        const errorMessage =
          `All services failed for ${serviceName}.${String(prop)}:\n` +
          failures.map((f) => `  - ${f.service}: ${f.error}`).join("\n");

        if (throwOnAllFailed) {
          throw new Error(errorMessage);
        }

        console.error(errorMessage);
        return undefined; // Graceful degradation
      };
    },
  };

  return new Proxy({} as T, handler);
}
