import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { MasterCopy } from './entities/master-copies.entity';
import { masterCopySchema } from './entities/schemas/master-copy.schema';

@Injectable()
export class MasterCopyValidator implements IValidator<MasterCopy> {
  private readonly isValidMasterCopy: ValidateFunction<MasterCopy>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidMasterCopy = this.jsonSchemaService.compile(
      masterCopySchema,
    ) as ValidateFunction<MasterCopy>;
  }

  validate(data: unknown): MasterCopy {
    if (!this.isValidMasterCopy(data)) {
      const errors = this.isValidMasterCopy.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as MasterCopy;
  }
}
