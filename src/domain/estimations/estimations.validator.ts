import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { Estimation } from './entities/estimation.entity';
import { estimationSchema } from './entities/schemas/estimation.schema';

@Injectable()
export class EstimationsValidator implements IValidator<Estimation> {
  private readonly isValidEstimation: ValidateFunction<Estimation>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidEstimation = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/estimations/estimation.json',
      estimationSchema,
    );
  }

  validate(data: unknown): Estimation {
    return this.genericValidator.validate(this.isValidEstimation, data);
  }
}
