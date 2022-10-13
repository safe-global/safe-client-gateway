import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { Transfer } from './entities/transfer.entity';
import { transferSchema } from './entities/schemas/transfer.schema';
import { GenericValidator } from '../schema/generic.validator';

@Injectable()
export class TransferValidator implements IValidator<Transfer> {
  private readonly isValidTransfer: ValidateFunction<Transfer>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidTransfer = this.jsonSchemaService.compile(
      transferSchema,
    ) as ValidateFunction<Transfer>;
  }

  validate(data: unknown): Transfer {
    return this.genericValidator.validate(this.isValidTransfer, data);
  }
}
