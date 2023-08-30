import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Page } from '../entities/page.entity';
import { IPageValidator } from '../interfaces/page-validator.interface';
import { IValidator } from '../interfaces/validator.interface';
import {
  ERC20_TRANSFER_SCHEMA_ID,
  erc20TransferSchema,
} from './entities/schemas/erc20-transfer.schema';
import {
  ERC721_TRANSFER_SCHEMA_ID,
  erc721TransferSchema,
} from './entities/schemas/erc721-transfer.schema';
import {
  NATIVE_TOKEN_TRANSFER_SCHEMA_ID,
  nativeTokenTransferSchema,
} from './entities/schemas/native-token-transfer.schema';
import {
  TRANSFER_PAGE_SCHEMA_ID,
  TRANSFER_SCHEMA_ID,
  transferPageSchema,
  transferSchema,
} from './entities/schemas/transfer.schema';
import { Transfer } from './entities/transfer.entity';

@Injectable()
export class TransferValidator
  implements IValidator<Transfer>, IPageValidator<Transfer>
{
  private readonly isValidTransfer: ValidateFunction<Transfer>;
  private readonly isValidPage: ValidateFunction<Page<Transfer>>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      NATIVE_TOKEN_TRANSFER_SCHEMA_ID,
      nativeTokenTransferSchema,
    );

    this.jsonSchemaService.getSchema(
      ERC20_TRANSFER_SCHEMA_ID,
      erc20TransferSchema,
    );

    this.jsonSchemaService.getSchema(
      ERC721_TRANSFER_SCHEMA_ID,
      erc721TransferSchema,
    );

    this.isValidTransfer = this.jsonSchemaService.getSchema(
      TRANSFER_SCHEMA_ID,
      transferSchema,
    );

    this.isValidPage = this.jsonSchemaService.getSchema(
      TRANSFER_PAGE_SCHEMA_ID,
      transferPageSchema,
    );
  }

  validate(data: unknown): Transfer {
    return this.genericValidator.validate(this.isValidTransfer, data);
  }

  validatePage(data: unknown): Page<Transfer> {
    return this.genericValidator.validate(this.isValidPage, data);
  }
}
