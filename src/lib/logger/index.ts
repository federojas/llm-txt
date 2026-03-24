/**
 * Structured Logger with Axiom Integration
 *
 * Production-grade logging with:
 * - Structured JSON output for queryability
 * - Correlation IDs for request tracing
 * - Axiom integration for long-term retention
 * - Pretty printing for local development
 * - Log levels: debug, info, warn, error
 */

import pino from "pino";
import type { Logger as PinoLogger } from "pino";

/**
 * Logger configuration based on environment
 */
const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

/**
 * Base logger configuration
 */
const baseConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,
  // Format errors properly
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  // Base context fields
  base: {
    env: process.env.NODE_ENV || "development",
    service: "llms-txt-generator",
  },
};

/**
 * Create transport for development (pretty printing)
 */
const devTransport = pino.transport({
  target: "pino-pretty",
  options: {
    colorize: true,
    translateTime: "HH:MM:ss.l",
    ignore: "pid,hostname",
  },
});

/**
 * Create transport for production (Axiom + console)
 * Falls back to console if Axiom credentials not configured
 */
const prodTransport = (() => {
  const hasAxiomConfig = process.env.AXIOM_API_KEY && process.env.AXIOM_DATASET;

  if (hasAxiomConfig) {
    // Multi-target transport: send to both Axiom and console
    return pino.transport({
      targets: [
        {
          target: "@axiomhq/pino",
          options: {
            dataset: process.env.AXIOM_DATASET,
            token: process.env.AXIOM_API_KEY,
          },
          level: "info",
        },
        {
          target: "pino/file",
          options: { destination: 1 }, // stdout
          level: "info",
        },
      ],
    });
  }

  // Fallback to console only if Axiom not configured
  return undefined; // Use default (stdout)
})();

/**
 * Root logger instance
 * Configured based on environment (dev: pretty, prod: JSON + Axiom)
 */
const rootLogger: PinoLogger = isTest
  ? pino({ ...baseConfig, level: "silent" }) // Silence logs in tests
  : isDevelopment
    ? pino(baseConfig, devTransport)
    : pino(baseConfig, prodTransport);

/**
 * Logger context interface
 * Add correlation IDs and additional context to logs
 */
export interface LoggerContext {
  correlationId?: string; // Request/job correlation ID
  jobId?: string; // Inngest job ID
  url?: string; // URL being processed
  userId?: string; // User identifier
  duration?: number; // Operation duration (ms)
  [key: string]: unknown; // Additional context fields
}

/**
 * Create a child logger with context
 *
 * @param context - Additional context fields (correlationId, jobId, etc.)
 * @returns Child logger with context
 *
 * @example
 * const logger = createLogger({ correlationId: '123', jobId: 'abc' });
 * logger.info('Starting crawl');
 * // Output: { level: 'info', msg: 'Starting crawl', correlationId: '123', jobId: 'abc' }
 */
export function createLogger(context?: LoggerContext): PinoLogger {
  if (!context || Object.keys(context).length === 0) {
    return rootLogger;
  }

  return rootLogger.child(context);
}

/**
 * Get the root logger instance
 * Use for simple logging without context
 *
 * @example
 * const logger = getLogger();
 * logger.info('Application started');
 */
export function getLogger(): PinoLogger {
  return rootLogger;
}

/**
 * Generate a correlation ID for request tracing
 * Format: timestamp-random (e.g., 1234567890-abc123)
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Type-safe logger interface
 * Export for dependency injection in tests
 */
export type Logger = PinoLogger;

/**
 * Default export: logger factory
 */
export default {
  createLogger,
  getLogger,
  generateCorrelationId,
};
