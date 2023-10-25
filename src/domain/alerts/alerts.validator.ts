import { ValidateFunction } from 'ajv';
import { Injectable } from '@nestjs/common';
import { Alert } from '@/domain/alerts/entities/alerts.entity';
import {
  ALERT_SCHEMA_ID,
  alertSchema,
} from '@/domain/alerts/entities/schemas/alerts.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class AlertsValidator implements IValidator<Alert> {
  private readonly isValidAlert: ValidateFunction<Alert>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidAlert = this.jsonSchemaService.getSchema(
      ALERT_SCHEMA_ID,
      alertSchema,
    );
  }

  validate(data: unknown): Alert {
    return this.genericValidator.validate(this.isValidAlert, data);
  }
}
