import { PipeTransform, UnprocessableEntityException } from '@nestjs/common';
import { ZodSchema, z } from 'zod';

export class ZodValidationPipe<T extends ZodSchema> implements PipeTransform {
  constructor(private schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new UnprocessableEntityException(result.error.issues[0]);
    }

    return result.data;
  }
}
