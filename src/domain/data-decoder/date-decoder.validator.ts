import { Injectable } from '@nestjs/common';
import { DefinedError, ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { DataDecoded } from './entities/data-decoded.entity';
import {
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from './entities/schemas/data-decoded.schema';

@Injectable()
export class DataDecodedValidator implements IValidator<DataDecoded> {
  private readonly isValidDataDecoded: ValidateFunction<DataDecoded>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.addSchema(
      dataDecodedParameterSchema,
      'dataDecodedParameter',
    );
    this.isValidDataDecoded = this.jsonSchemaService.compile(
      dataDecodedSchema,
    ) as ValidateFunction<DataDecoded>;
  }

  validate(data: unknown): DataDecoded {
    if (!this.isValidDataDecoded(data)) {
      const errors = this.isValidDataDecoded.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as DataDecoded;
  }
}
