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
import { IncomingEther } from '../entities/incoming-ether.entity';
import { incomingEtherEventSchema } from '../entities/schemas/incoming-ether.schema';
import { incomingTokenEventSchema } from '../entities/schemas/incoming-token.schema';
import { IncomingToken } from '../entities/incoming-token.entity';
import { outgoingEtherEventSchema } from '../entities/schemas/outgoing-ether.schema';
import { OutgoingEther } from '../entities/outgoing-ether.entity';
import { outgoingTokenEventSchema } from '../entities/schemas/outgoing-token.schema';
import { OutgoingToken } from '../entities/outgoing-token.entity';
import { ModuleTransaction } from '../entities/module-transaction.entity';
import { moduleTransactionEventSchema } from '../entities/schemas/module-transaction.schema';

@Injectable()
export class EventValidationPipe
  implements
    PipeTransform<
      any,
      | ExecutedTransaction
      | IncomingEther
      | IncomingToken
      | ModuleTransaction
      | NewConfirmation
      | OutgoingToken
      | OutgoingEther
      | PendingTransaction
    >
{
  private readonly isWebHookEvent: ValidateFunction<
    | ExecutedTransaction
    | IncomingEther
    | IncomingToken
    | ModuleTransaction
    | NewConfirmation
    | OutgoingToken
    | OutgoingEther
    | PendingTransaction
  >;

  constructor(private readonly jsonSchemaService: JsonSchemaService) {
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/executed-transaction.json',
      executedTransactionEventSchema,
    );
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/incoming-ether.json',
      incomingEtherEventSchema,
    );
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/incoming-token.json',
      incomingTokenEventSchema,
    );
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/module-transaction.json',
      moduleTransactionEventSchema,
    );
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/new-confirmation.json',
      newConfirmationEventSchema,
    );
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/outgoing-ether.json',
      outgoingEtherEventSchema,
    );
    jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/cache-hooks/outgoing-token.json',
      outgoingTokenEventSchema,
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
  ):
    | ExecutedTransaction
    | IncomingEther
    | IncomingToken
    | ModuleTransaction
    | NewConfirmation
    | OutgoingToken
    | OutgoingEther
    | PendingTransaction {
    if (this.isWebHookEvent(value)) {
      return value;
    }
    throw new BadRequestException('Validation failed');
  }
}
