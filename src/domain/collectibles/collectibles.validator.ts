import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { collectibleSchema } from './entities/schemas/collectible.schema';
import { Collectible } from './entities/collectible.entity';

@Injectable()
export class CollectiblesValidator implements IValidator<Collectible> {
  private readonly isValidCollectible: ValidateFunction<Collectible>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidCollectible = this.jsonSchemaService.compile(
      collectibleSchema,
    ) as ValidateFunction<Collectible>;
  }

  validate(data: unknown): Collectible {
    return this.genericValidator.validate(this.isValidCollectible, data);
  }
}
