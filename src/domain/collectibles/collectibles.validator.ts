import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { Collectible } from './entities/collectible.entity';
import { collectibleSchema } from './entities/schemas/collectible.schema';

@Injectable()
export class CollectiblesValidator implements IValidator<Collectible> {
  private readonly isValidCollectible: ValidateFunction<Collectible>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidCollectible = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/collectibles/collectible.json',
      collectibleSchema,
    );
  }

  validate(data: unknown): Collectible {
    return this.genericValidator.validate(this.isValidCollectible, data);
  }
}
