import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { GenericValidator } from '../schema/generic.validator';
import { JsonSchemaService } from '../schema/json-schema.service';
import { DataDecoded } from './entities/data-decoded.entity';
import {
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
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded-parameter.json',
      dataDecodedParameterSchema,
    );
    this.isValidDataDecoded = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded.json',
      dataDecodedSchema,
    );
  }

  validate(data: unknown): DataDecoded {
    return this.genericValidator.validate(this.isValidDataDecoded, data);
  }
}
