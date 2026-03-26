/**
 * Custom API Error Classes
 * Provides structured error handling with appropriate HTTP status codes
 */

export abstract class ApiError extends Error {
  abstract statusCode: number;
  abstract code: string;
  public details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  statusCode = 400;
  code = "VALIDATION_ERROR";

  constructor(message: string = "Invalid input", details?: unknown) {
    super(message, details);
  }
}

export class NotFoundError extends ApiError {
  statusCode = 404;
  code = "NOT_FOUND";

  constructor(message: string = "Resource not found", details?: unknown) {
    super(message, details);
  }
}

export class InternalServerError extends ApiError {
  statusCode = 500;
  code = "INTERNAL_SERVER_ERROR";

  constructor(message: string = "Internal server error", details?: unknown) {
    super(message, details);
  }
}

export class BadRequestError extends ApiError {
  statusCode = 400;
  code = "BAD_REQUEST";

  constructor(message: string = "Bad request", details?: unknown) {
    super(message, details);
  }
}

export class TimeoutError extends ApiError {
  statusCode = 408;
  code = "TIMEOUT";

  constructor(message: string = "Request timeout", details?: unknown) {
    super(message, details);
  }
}

export class RateLimitError extends ApiError {
  statusCode = 429;
  code = "RATE_LIMIT_EXCEEDED";
  public resetMs: number; // Unix timestamp when rate limit resets

  constructor(
    message: string = "Rate limit exceeded",
    resetMs: number,
    details?: unknown
  ) {
    super(message, details);
    this.resetMs = resetMs;
  }
}
