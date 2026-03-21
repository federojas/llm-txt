/**
 * Request Validation Middleware
 * Validates request bodies against Zod schemas
 */

import { NextRequest } from "next/server";
import { z, ZodSchema } from "zod";
import { ValidationError } from "@/lib/api";

/**
 * Validates request body against a Zod schema
 * @throws ValidationError if validation fails
 */
export async function validateRequest<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid input", error.issues);
    }
    throw error;
  }
}

/**
 * Validates data against a Zod schema
 * @throws ValidationError if validation fails
 */
export function validate<T extends ZodSchema>(
  data: unknown,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid data", error.issues);
    }
    throw error;
  }
}
