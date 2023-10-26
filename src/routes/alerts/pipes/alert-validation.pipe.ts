import { ValidateFunction } from 'ajv';
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { Alert } from '@/routes/alerts/entities/alert.dto';
import {
  ALERT_LOGS_SCHEMA_ID,
  ALERT_SCHEMA_ID,
  ALERT_TRANSACTION_SCHEMA_ID,
  alertLogsSchema,
  alertSchema,
  alertTransactionSchema,
} from '@/routes/alerts/entities/schemas/alerts.schema';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class AlertValidationPipe implements PipeTransform<Alert> {
  private readonly isAlert: ValidateFunction<Alert>;

  constructor(private readonly jsonSchemaService: JsonSchemaService) {
    jsonSchemaService.getSchema(ALERT_LOGS_SCHEMA_ID, alertLogsSchema);

    jsonSchemaService.getSchema(
      ALERT_TRANSACTION_SCHEMA_ID,
      alertTransactionSchema,
    );

    this.isAlert = jsonSchemaService.getSchema(ALERT_SCHEMA_ID, alertSchema);
  }

  transform(value: unknown): Alert {
    if (this.isAlert(value)) {
      return value;
    }
    throw new BadRequestException('Validation failed');
  }
}
