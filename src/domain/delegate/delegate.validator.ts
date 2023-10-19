import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import {
  DELEGATE_SCHEMA_ID,
  delegateSchema,
} from '@/domain/delegate/entities/schemas/delegate.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { ValidationErrorFactory } from '@/validation/providers/validation-error-factory';

@Injectable()
export class DelegateValidator implements IValidator<Delegate> {
  private readonly isValidDelegate: ValidateFunction<Delegate>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidDelegate = this.jsonSchemaService.getSchema(
      DELEGATE_SCHEMA_ID,
      delegateSchema,
    );
  }

  validate(data: unknown): Delegate {
    if (!this.isValidDelegate(data)) {
      const errors = this.isValidDelegate.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as Delegate;
  }
}
