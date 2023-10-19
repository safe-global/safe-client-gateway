import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { Estimation } from '@/domain/estimations/entities/estimation.entity';
import {
  ESTIMATION_SCHEMA_ID,
  estimationSchema,
} from '@/domain/estimations/entities/schemas/estimation.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

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
