import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { backboneSchema } from '../balances/entities/schemas/backbone.schema';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { Backbone } from './entities/backbone.entity';

@Injectable()
export class BackboneValidator implements IValidator<Backbone> {
  private readonly isValidBackbone: ValidateFunction<Backbone>;

  constructor(
    private readonly simpleValidator: SimpleValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidBackbone = this.jsonSchemaService.compile(
      backboneSchema,
    ) as ValidateFunction<Backbone>;
  }

  validate(data: unknown): Backbone {
    this.simpleValidator.execute(this.isValidBackbone, data);
    return data as Backbone;
  }
}
