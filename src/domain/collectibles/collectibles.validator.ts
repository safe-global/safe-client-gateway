import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import {
  COLLECTIBLE_SCHEMA_ID,
  collectibleSchema,
} from '@/domain/collectibles/entities/schemas/collectible.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class CollectiblesValidator implements IValidator<Collectible> {
  private readonly isValidCollectible: ValidateFunction<Collectible>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidCollectible = this.jsonSchemaService.getSchema(
      COLLECTIBLE_SCHEMA_ID,
      collectibleSchema,
    );
  }

  validate(data: unknown): Collectible {
    return this.genericValidator.validate(this.isValidCollectible, data);
  }
}
