import { PipeTransform } from '@nestjs/common';
import { ZodSchema, z } from 'zod';

export class ValidationPipe<T extends ZodSchema> implements PipeTransform {
  constructor(private schema: T) {}

  transform(value: unknown): z.infer<T> {
    return this.schema.parse(value);
  }
}
