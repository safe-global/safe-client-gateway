import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { Collectible } from '../../routes/collectibles/entities/collectible.entity';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { collectibleSchema } from './entities/schemas/collectible.schema';

@Injectable()
export class CollectibleValidator implements IValidator<Collectible> {
  private readonly isValidCollectible: ValidateFunction<Collectible>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidCollectible = this.jsonSchemaService.compile(
      collectibleSchema,
    ) as ValidateFunction<Collectible>;
  }

  validate(data: unknown): Collectible {
    if (!this.isValidCollectible(data)) {
      const errors = this.isValidCollectible.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as Collectible;
  }
}
