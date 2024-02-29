import { Page } from '@/domain/entities/page.entity';
import { IPageValidator } from '@/domain/interfaces/validator.interface';
import { LockingEvent } from '@/domain/locking/entities/locking-event.entity';
import {
  LOCKING_EVENT_PAGE_SCHEMA_ID,
  lockingEventPageSchema,
} from '@/domain/locking/entities/schemas/locking-event.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';

@Injectable()
export class LockingEventValidator implements IPageValidator<LockingEvent> {
  private readonly isValidPage: ValidateFunction<Page<LockingEvent>>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidPage = this.jsonSchemaService.getSchema(
      LOCKING_EVENT_PAGE_SCHEMA_ID,
      lockingEventPageSchema,
    );
  }

  validatePage(data: unknown): Page<LockingEvent> {
    return this.genericValidator.validate(this.isValidPage, data);
  }
}
