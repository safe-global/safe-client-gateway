import { ValidateFunction } from 'ajv';
import { Injectable } from '@nestjs/common';
import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import {
  BACKBONE_SCHEMA_ID,
  backboneSchema,
} from '@/domain/backbone/entities/schemas/backbone.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class BackboneValidator implements IValidator<Backbone> {
  private readonly isValidBackbone: ValidateFunction<Backbone>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidBackbone = this.jsonSchemaService.getSchema(
      BACKBONE_SCHEMA_ID,
      backboneSchema,
    );
  }

  validate(data: unknown): Backbone {
    return this.genericValidator.validate(this.isValidBackbone, data);
  }
}
