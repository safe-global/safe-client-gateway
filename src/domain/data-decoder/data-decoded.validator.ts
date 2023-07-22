import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { DataDecoded } from './entities/data-decoded.entity';
import {
  DATA_DECODED_PARAMETER_SCHEMA_ID,
  DATA_DECODED_SCHEMA_ID,
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from './entities/schemas/data-decoded.schema';

@Injectable()
export class DataDecodedValidator implements IValidator<DataDecoded> {
  private readonly isValidDataDecoded: ValidateFunction<DataDecoded>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      DATA_DECODED_PARAMETER_SCHEMA_ID,
      dataDecodedParameterSchema,
    );
    this.isValidDataDecoded = this.jsonSchemaService.getSchema(
      DATA_DECODED_SCHEMA_ID,
      dataDecodedSchema,
    );
  }

  validate(data: unknown): DataDecoded {
    return this.genericValidator.validate(this.isValidDataDecoded, data);
  }
}
