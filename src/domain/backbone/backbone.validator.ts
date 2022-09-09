import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { backboneSchema } from '../balances/entities/schemas/backbone.schema';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { IValidator } from '../interfaces/validator.interface';
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

  validateMany(data: unknown[]): Backbone[] {
    return data.map((item) => this.validate(item));
  }
}
