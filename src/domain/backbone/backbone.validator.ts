import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { Backbone } from './entities/backbone.entity';
import { backboneSchema } from './entities/schemas/backbone.schema';

@Injectable()
export class BackboneValidator implements IValidator<Backbone> {
  private readonly isValidBackbone: ValidateFunction<Backbone>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidBackbone = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/backbone/backbone.json',
      backboneSchema,
    );
  }

  validate(data: unknown): Backbone {
    return this.genericValidator.validate(this.isValidBackbone, data);
  }
}
