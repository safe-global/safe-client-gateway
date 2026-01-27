import type { PipeTransform } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { ZodError, ZodType, z } from 'zod';

export class ZodErrorWithCode extends ZodError {
  constructor(
    issues: Array<z.core.$ZodIssue>,
    public readonly code: number,
  ) {
    super(issues);
  }
}

export class ValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(
    private readonly schema: T,
    private readonly code = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new ZodErrorWithCode(result.error.issues, this.code);
  }
}
