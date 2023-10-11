import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IPageValidator } from '@/domain/interfaces/page-validator.interface';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { Message } from '@/domain/messages/entities/message.entity';
import {
  MESSAGE_CONFIRMATION_SCHEMA_ID,
  MESSAGE_PAGE_SCHEMA_ID,
  MESSAGE_SCHEMA_ID,
  messageConfirmationSchema,
  messagePageSchema,
  messageSchema,
} from '@/domain/messages/entities/schemas/message.schema';
import { Page } from '@/routes/common/entities/page.entity';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

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
      MESSAGE_CONFIRMATION_SCHEMA_ID,
      messageConfirmationSchema,
    );
    this.isValidMessage = this.jsonSchemaValidator.getSchema(
      MESSAGE_SCHEMA_ID,
      messageSchema,
    );
    this.isValidPage = this.jsonSchemaValidator.getSchema(
      MESSAGE_PAGE_SCHEMA_ID,
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
