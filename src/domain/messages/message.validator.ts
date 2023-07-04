import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { Page } from '../../routes/common/entities/page.entity';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IPageValidator } from '../interfaces/page-validator.interface';
import { IValidator } from '../interfaces/validator.interface';
import { Message } from './entities/message.entity';
import {
  messageConfirmationSchema,
  messagePageSchema,
  messageSchema,
} from './entities/schemas/message.schema';

@Injectable()
export class MessageValidator
  implements IValidator<Message>, IPageValidator<Message>
{
  private readonly isValidMessage: ValidateFunction<Message>;
  private readonly isValidPage: ValidateFunction<Page<Message>>;

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
    this.isValidPage = this.jsonSchemaValidator.getSchema(
      'https://safe-client.safe.global/schemas/messages/message-page.json',
      messagePageSchema,
    );
  }

  validate(data: unknown): Message {
    return this.genericValidator.validate(this.isValidMessage, data);
  }

  validatePage(data: unknown): Page<Message> {
    return this.genericValidator.validate(this.isValidPage, data);
  }
}
