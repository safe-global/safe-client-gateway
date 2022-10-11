import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { backboneSchema } from '../balances/entities/schemas/backbone.schema';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { Backbone } from './entities/backbone.entity';

@Injectable()
export class BackboneValidator implements IValidator<Backbone> {
  private readonly isValidBackbone: ValidateFunction<Backbone>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidBackbone = this.jsonSchemaService.compile(
      backboneSchema,
    ) as ValidateFunction<Backbone>;
  }

  validate(data: unknown): Backbone {
    this.genericValidator.execute(this.isValidBackbone, data);
    return data as Backbone;
  }
}
