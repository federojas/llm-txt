/**
 * Structured Logger with Axiom Integration (next-axiom)
 *
 * Production-grade logging with:
 * - Structured JSON output for queryability
 * - Correlation IDs for request tracing
 * - Axiom integration via next-axiom
 * - Automatic log flushing for serverless
 * - Log levels: debug, info, warn, error
 */

import { Logger as AxiomLogger } from "next-axiom";

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
 * Logger interface compatible with our existing API
 * Wraps next-axiom Logger with our context-aware methods
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  flush(): Promise<void>;
}

/**
 * Context-aware logger that wraps Axiom Logger
 */
class ContextLogger implements Logger {
  private axiomLogger: AxiomLogger;
  private context: LoggerContext;

  constructor(context: LoggerContext = {}) {
    this.axiomLogger = new AxiomLogger();
    this.context = context;
  }

  private mergeContext(additionalContext?: Record<string, unknown>) {
    return {
      ...this.context,
      ...additionalContext,
      env: process.env.NODE_ENV || "development",
      service: "llms-txt-generator",
    };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.axiomLogger.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.axiomLogger.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.axiomLogger.warn(message, this.mergeContext(context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.axiomLogger.error(message, this.mergeContext(context));
  }

  async flush(): Promise<void> {
    await this.axiomLogger.flush();
  }
}

/**
 * Create a logger with context
 *
 * @param context - Additional context fields (correlationId, jobId, etc.)
 * @returns Logger instance with context
 *
 * @example
 * const logger = createLogger({ correlationId: '123', jobId: 'abc' });
 * logger.info('Starting crawl');
 * await logger.flush(); // Important for serverless environments
 */
export function createLogger(context?: LoggerContext): Logger {
  return new ContextLogger(context);
}

/**
 * Get a logger instance without context
 * Use for simple logging scenarios
 *
 * @example
 * const logger = getLogger();
 * logger.info('Application started');
 * await logger.flush();
 */
export function getLogger(): Logger {
  return new ContextLogger();
}

/**
 * Generate a correlation ID for request tracing
 * Format: timestamp-random (e.g., 1234567890-abc123)
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Default export: logger factory
 */
export default {
  createLogger,
  getLogger,
  generateCorrelationId,
};
