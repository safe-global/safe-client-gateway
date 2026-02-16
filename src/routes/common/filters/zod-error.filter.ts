import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { ZodError, z } from 'zod';
import { type Response } from 'express';
import { ZodErrorWithCode } from '@/validation/pipes/validation.pipe';

/**
 * Exception filter that handles Zod validation errors throughout the application.
 *
 * This filter catches two types of validation errors:
 *
 * 1. **ZodErrorWithCode** (from ValidationPipe at route level):
 *    - Thrown when user input fails validation (e.g., @Body, @Param, @Query)
 *    - Returns HTTP 422 (Unprocessable Entity) with detailed error information
 *    - Safe to expose details since these are user input errors
 *
 * 2. **ZodError** (from domain/service layer):
 *    - Thrown when internal validation fails (e.g., parsing external API responses)
 *    - Returns HTTP 502 (Bad Gateway) with generic error message
 *    - Details are hidden for security (may contain sensitive internal data)
 */
@Catch(ZodError, ZodErrorWithCode)
export class ZodErrorFilter implements ExceptionFilter {
  catch(exception: ZodError | ZodErrorWithCode, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Check if this is a ZodErrorWithCode (has HTTP status code property)
    // Note: In Zod 4, both ZodError and ZodErrorWithCode pass instanceof checks
    // due to Zod's trait-based type system, so we check for the 'code' property
    if (exception instanceof ZodError && 'code' in exception) {
      const code = exception.code;
      const error = this.mapZodErrorResponse(exception);

      response.status(code).json({
        statusCode: code,
        ...error,
      });
    } else {
      // Domain-level validation error (internal) - hide details for security
      response.status(HttpStatus.BAD_GATEWAY).json({
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'Bad gateway',
      });
    }
  }

  /**
   * Extracts the most relevant error issue from a ZodError.
   *
   * For union type validation errors, this method recursively drills down
   * to find the first concrete validation error instead of returning the
   * generic "invalid_union" error.
   *
   * Zod 4 changes:
   * - Union errors now have an `errors` array (array of arrays of issues)
   * - Previously in Zod 3, it was a single `unionErrors` property
   *
   * @param exception - The ZodError to extract the issue from
   * @returns The first concrete validation issue
   *
   * @example
   * For a schema: z.union([z.string(), z.number()])
   * When passed a boolean, instead of returning:
   *   { code: "invalid_union", ... }
   * Returns the first concrete error:
   *   { code: "invalid_type", expected: "string", received: "boolean", ... }
   */
  private mapZodErrorResponse(exception: ZodError): z.core.$ZodIssue {
    const firstIssue = exception.issues[0];
    if (
      firstIssue.code === 'invalid_union' &&
      'errors' in firstIssue &&
      Array.isArray(firstIssue.errors)
    ) {
      const firstUnionErrors = firstIssue.errors[0];
      if (Array.isArray(firstUnionErrors) && firstUnionErrors.length > 0) {
        const firstError = firstUnionErrors[0];
        // Recursively handle nested unions (e.g., z.union([z.union([...]), ...]))
        if (firstError.code === 'invalid_union') {
          return this.mapZodErrorResponse({
            issues: [firstError],
          } as ZodError);
        }
        return firstError;
      }
    }
    return firstIssue;
  }
}
