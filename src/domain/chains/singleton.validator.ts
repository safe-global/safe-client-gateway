import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { Singleton } from '@/domain/chains/entities/singleton.entity';
import {
  SINGLETON_SCHEMA_ID,
  singletonSchema,
} from '@/domain/chains/entities/schemas/singleton.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class SingletonValidator implements IValidator<Singleton> {
  private readonly isValidSingleton: ValidateFunction<Singleton>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidSingleton = this.jsonSchemaService.getSchema(
      SINGLETON_SCHEMA_ID,
      singletonSchema,
    );
  }

  validate(data: unknown): Singleton {
    return this.genericValidator.validate(this.isValidSingleton, data);
  }
}
