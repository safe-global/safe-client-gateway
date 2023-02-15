import { HttpStatus, Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { ValidationErrorFactory } from './validation-error-factory';

@Injectable()
export class GenericValidator {
  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
  ) {}

  validate<T>(fn: ValidateFunction, data: unknown, code?: HttpStatus): T {
    if (!fn(data)) {
      const errors = fn.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors, code);
    }

    return data as T;
  }
}
