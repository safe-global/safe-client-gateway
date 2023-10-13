import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { ValidationErrorFactory } from '@/validation/providers/validation-error-factory';

@Injectable()
export class GenericValidator {
  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
  ) {}

  validate<T>(fn: ValidateFunction, data: unknown): T {
    if (!fn(data)) {
      const errors = fn.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as T;
  }
}
