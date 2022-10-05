import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { backboneSchema } from '../balances/entities/schemas/backbone.schema';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { Backbone } from './entities/backbone.entity';

@Injectable()
export class BackboneValidator implements IValidator<Backbone> {
  private readonly isValidBackbone: ValidateFunction<Backbone>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidBackbone = this.jsonSchemaService.compile(
      backboneSchema,
    ) as ValidateFunction<Backbone>;
  }

  validate(data: unknown): Backbone {
    if (!this.isValidBackbone(data)) {
      const errors = this.isValidBackbone.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as Backbone;
  }
}
