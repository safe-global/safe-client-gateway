import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { executedTransactionEventSchema } from '../entities/schemas/executed-transaction.schema';
import { newConfirmationEventSchema } from '../entities/schemas/new-confirmation.schema';
import { pendingTransactionEventSchema } from '../entities/schemas/pending-transaction.schema';
import { webHookSchema } from '../entities/schemas/web-hook.schema';
import { ExecutedTransaction } from '../entities/executed-transaction.entity';
import { NewConfirmation } from '../entities/new-confirmation.entity';
import { PendingTransaction } from '../entities/pending-transaction.entity';

@Injectable()
export class EventValidationPipe
  implements
    PipeTransform<
      any,
      ExecutedTransaction | NewConfirmation | PendingTransaction
    >
{
  private readonly isWebHookEvent: ValidateFunction<
    ExecutedTransaction | NewConfirmation | PendingTransaction
  >;

  constructor(private readonly jsonSchemaService: JsonSchemaService) {
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/executed-transaction.json',
      executedTransactionEventSchema,
    );
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/new-confirmation.json',
      newConfirmationEventSchema,
    );
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/pending-transaction.json',
      pendingTransactionEventSchema,
    );
    this.isWebHookEvent = jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/web-hook.json',
      webHookSchema,
    );
  }

  transform(
    value: any,
  ): ExecutedTransaction | NewConfirmation | PendingTransaction {
    if (this.isWebHookEvent(value)) {
      return value;
    }
    throw new BadRequestException('Validation failed');
  }
}
