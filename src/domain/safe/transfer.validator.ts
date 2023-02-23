import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { erc20TransferSchema } from './entities/schemas/erc20-transfer.schema';
import { erc721TransferSchema } from './entities/schemas/erc721-transfer.schema';
import { nativeTokenTransferSchema } from './entities/schemas/native-token-transfer.schema';
import { transferSchema } from './entities/schemas/transfer.schema';
import { Transfer } from './entities/transfer.entity';

@Injectable()
export class TransferValidator implements IValidator<Transfer> {
  private readonly isValidTransfer: ValidateFunction<Transfer>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/native-token-transfer.json',
      nativeTokenTransferSchema,
    );
    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/erc20-transfer.json',
      erc20TransferSchema,
    );
    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/erc721-transfer.json',
      erc721TransferSchema,
    );
    this.isValidTransfer = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/transfer.json',
      transferSchema,
    );
  }

  validate(data: unknown): Transfer {
    return this.genericValidator.validate(this.isValidTransfer, data);
  }
}
