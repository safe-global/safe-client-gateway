import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { Estimation } from './entities/estimation.entity';
import {
  ESTIMATION_SCHEMA_ID,
  estimationSchema,
} from './entities/schemas/estimation.schema';

@Injectable()
export class EstimationsValidator implements IValidator<Estimation> {
  private readonly isValidEstimation: ValidateFunction<Estimation>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidEstimation = this.jsonSchemaService.getSchema(
      ESTIMATION_SCHEMA_ID,
      estimationSchema,
    );
  }

  validate(data: unknown): Estimation {
    return this.genericValidator.validate(this.isValidEstimation, data);
  }
}
