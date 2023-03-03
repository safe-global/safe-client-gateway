import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { ExecutedTransaction } from '../entities/executed-transaction.entity';
import { NewConfirmation } from '../entities/new-confirmation.entity';
import { PendingTransaction } from '../entities/pending-transaction.entity';
import { executedTransactionEventSchema } from '../entities/schemas/executed-transaction.schema';
import { newConfirmationEventSchema } from '../entities/schemas/new-confirmation.schema';
import { pendingTransactionEventSchema } from '../entities/schemas/pending-transaction.schema';

@Injectable()
export class EventValidationPipe
  implements
    PipeTransform<
      any,
      ExecutedTransaction | NewConfirmation | PendingTransaction
    >
{
  private readonly isExecutedTransactionEvent: ValidateFunction<ExecutedTransaction>;
  private readonly isNewConfirmationEvent: ValidateFunction<NewConfirmation>;
  private readonly isPendingTransactionEvent: ValidateFunction<PendingTransaction>;

  constructor(private readonly jsonSchemaService: JsonSchemaService) {
    this.isExecutedTransactionEvent = jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/executed-transaction.json',
      executedTransactionEventSchema,
    );
    this.isNewConfirmationEvent = jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/new-confirmation.json',
      newConfirmationEventSchema,
    );
    this.isPendingTransactionEvent = jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/pending-transaction.json',
      pendingTransactionEventSchema,
    );
  }

  transform(
    value: any,
  ): ExecutedTransaction | NewConfirmation | PendingTransaction {
    this.isExecutedTransactionEvent(value);

    if (
      this.isExecutedTransactionEvent(value) ||
      this.isNewConfirmationEvent(value) ||
      this.isPendingTransactionEvent(value)
    ) {
      return value;
    }
    throw new BadRequestException('Validation failed');
  }
}
