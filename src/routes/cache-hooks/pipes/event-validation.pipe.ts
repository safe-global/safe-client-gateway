import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import {
  EXECUTED_TRANSACTION_EVENT_SCHEMA_ID,
  executedTransactionEventSchema,
} from '../entities/schemas/executed-transaction.schema';
import {
  NEW_CONFIRMATION_EVENT_SCHEMA_ID,
  newConfirmationEventSchema,
} from '../entities/schemas/new-confirmation.schema';
import {
  PENDING_TRANSACTION_EVENT_SCHEMA_ID,
  pendingTransactionEventSchema,
} from '../entities/schemas/pending-transaction.schema';
import {
  WEB_HOOK_SCHEMA_ID,
  webHookSchema,
} from '../entities/schemas/web-hook.schema';
import { ExecutedTransaction } from '../entities/executed-transaction.entity';
import { NewConfirmation } from '../entities/new-confirmation.entity';
import { PendingTransaction } from '../entities/pending-transaction.entity';
import { IncomingEther } from '../entities/incoming-ether.entity';
import {
  INCOMING_ETHER_EVENT_SCHEMA_ID,
  incomingEtherEventSchema,
} from '../entities/schemas/incoming-ether.schema';
import {
  INCOMING_TOKEN_EVENT_SCHEMA_ID,
  incomingTokenEventSchema,
} from '../entities/schemas/incoming-token.schema';
import { IncomingToken } from '../entities/incoming-token.entity';
import {
  OUTGOING_ETHER_EVENT_SCHEMA_ID,
  outgoingEtherEventSchema,
} from '../entities/schemas/outgoing-ether.schema';
import { OutgoingEther } from '../entities/outgoing-ether.entity';
import {
  OUTGOING_TOKEN_EVENT_SCHEMA_ID,
  outgoingTokenEventSchema,
} from '../entities/schemas/outgoing-token.schema';
import { OutgoingToken } from '../entities/outgoing-token.entity';
import { ModuleTransaction } from '../entities/module-transaction.entity';
import {
  MODULE_TRANSACTION_EVENT_SCHEMA_ID,
  moduleTransactionEventSchema,
} from '../entities/schemas/module-transaction.schema';
import { MessageCreated } from '../entities/message-created.entity';
import {
  MESSAGE_CREATED_EVENT_SCHEMA_ID,
  messageCreatedEventSchema,
} from '../entities/schemas/message-created.schema';

@Injectable()
export class EventValidationPipe
  implements
    PipeTransform<
      any,
      | ExecutedTransaction
      | IncomingEther
      | IncomingToken
      | MessageCreated
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
    | MessageCreated
    | ModuleTransaction
    | NewConfirmation
    | OutgoingToken
    | OutgoingEther
    | PendingTransaction
  >;

  constructor(private readonly jsonSchemaService: JsonSchemaService) {
    jsonSchemaService.getSchema(
      EXECUTED_TRANSACTION_EVENT_SCHEMA_ID,
      executedTransactionEventSchema,
    );
    jsonSchemaService.getSchema(
      INCOMING_ETHER_EVENT_SCHEMA_ID,
      incomingEtherEventSchema,
    );
    jsonSchemaService.getSchema(
      INCOMING_TOKEN_EVENT_SCHEMA_ID,
      incomingTokenEventSchema,
    );
    jsonSchemaService.getSchema(
      MESSAGE_CREATED_EVENT_SCHEMA_ID,
      messageCreatedEventSchema,
    );
    jsonSchemaService.getSchema(
      MODULE_TRANSACTION_EVENT_SCHEMA_ID,
      moduleTransactionEventSchema,
    );
    jsonSchemaService.getSchema(
      NEW_CONFIRMATION_EVENT_SCHEMA_ID,
      newConfirmationEventSchema,
    );
    jsonSchemaService.getSchema(
      OUTGOING_ETHER_EVENT_SCHEMA_ID,
      outgoingEtherEventSchema,
    );
    jsonSchemaService.getSchema(
      OUTGOING_TOKEN_EVENT_SCHEMA_ID,
      outgoingTokenEventSchema,
    );
    jsonSchemaService.getSchema(
      PENDING_TRANSACTION_EVENT_SCHEMA_ID,
      pendingTransactionEventSchema,
    );
    this.isWebHookEvent = jsonSchemaService.getSchema(
      WEB_HOOK_SCHEMA_ID,
      webHookSchema,
    );
  }

  transform(
    value: any,
  ):
    | ExecutedTransaction
    | IncomingEther
    | IncomingToken
    | MessageCreated
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
