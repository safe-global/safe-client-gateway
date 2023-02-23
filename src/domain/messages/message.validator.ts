import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { Message } from './entities/message.entity';
import {
  messageConfirmationSchema,
  messageSchema,
} from './entities/schemas/message.schema';

@Injectable()
export class MessageValidator implements IValidator<Message> {
  private readonly isValidMessage: ValidateFunction<Message>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaValidator: JsonSchemaService,
  ) {
    this.jsonSchemaValidator.getSchema(
      'https://safe-client.safe.global/schemas/messages/message-confirmation.json',
      messageConfirmationSchema,
    );
    this.isValidMessage = this.jsonSchemaValidator.getSchema(
      'https://safe-client.safe.global/schemas/messages/message.json',
      messageSchema,
    );
  }

  validate(data: unknown): Message {
    return this.genericValidator.validate(this.isValidMessage, data);
  }
}
