import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { Safe } from './entities/safe.entity';
import { safeSchema } from './entities/schemas/safe.schema';

@Injectable()
export class SafeValidator implements IValidator<Safe> {
  private readonly isValidSafe: ValidateFunction<Safe>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidSafe = this.jsonSchemaService.compile(
      safeSchema,
    ) as ValidateFunction<Safe>;
  }

  validate(data: unknown): Safe {
    this.genericValidator.execute(this.isValidSafe, data);
    return data as Safe;
  }
}
