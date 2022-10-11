import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { ValidationErrorFactory } from './validation-error-factory';

@Injectable()
export class GenericValidator {
  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
  ) {}

  execute(fn: ValidateFunction, data: unknown): void {
    if (!fn(data)) {
      const errors = fn.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }
  }
}
