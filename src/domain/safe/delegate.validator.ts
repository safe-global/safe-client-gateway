import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { Delegate } from './entities/delegate.entity';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { delegateSchema } from './entities/schemas/delegate.schema';

@Injectable()
export class DelegateValidator implements IValidator<Delegate> {
  private readonly isValidDelegate: ValidateFunction<Delegate>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidDelegate = this.jsonSchemaService.compile(
      delegateSchema,
    ) as ValidateFunction<Delegate>;
  }

  validate(data: unknown): Delegate {
    if (!this.isValidDelegate(data)) {
      const errors = this.isValidDelegate.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as Delegate;
  }
}
