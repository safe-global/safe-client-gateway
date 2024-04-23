import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import {
  DATA_DECODED_PARAMETER_SCHEMA_ID,
  DATA_DECODED_SCHEMA_ID,
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '@/domain/data-decoder/entities/schemas/data-decoded.schema';
import { Page } from '@/domain/entities/page.entity';
import { IPageValidator } from '@/domain/interfaces/page-validator.interface';
import { IValidator } from '@/domain/interfaces/validator.interface';
import {
  ERC20_TRANSFER_SCHEMA_ID,
  erc20TransferSchema,
} from '@/domain/safe/entities/schemas/erc20-transfer.schema';
import {
  ERC721_TRANSFER_SCHEMA_ID,
  erc721TransferSchema,
} from '@/domain/safe/entities/schemas/erc721-transfer.schema';
import {
  ETHEREUM_TRANSACTION_TYPE_SCHEMA_ID,
  ethereumTransactionTypeSchema,
} from '@/domain/safe/entities/schemas/ethereum-transaction-type.schema';
import {
  MODULE_TRANSACTION_TYPE_SCHEMA_ID,
  moduleTransactionTypeSchema,
} from '@/domain/safe/entities/schemas/module-transaction-type.schema';
import {
  MULTISIG_TRANSACTION_TYPE_SCHEMA_ID,
  multisigTransactionTypeSchema,
} from '@/domain/safe/entities/schemas/multisig-transaction-type.schema';
import {
  NATIVE_TOKEN_TRANSFER_SCHEMA_ID,
  nativeTokenTransferSchema,
} from '@/domain/safe/entities/schemas/native-token-transfer.schema';
import {
  TRANSACTION_TYPE_PAGE_SCHEMA_ID,
  TRANSACTION_TYPE_SCHEMA_ID,
  transactionTypePageSchema,
  transactionTypeSchema,
} from '@/domain/safe/entities/schemas/transaction-type.schema';
import {
  TRANSFER_SCHEMA_ID,
  transferSchema,
} from '@/domain/safe/entities/schemas/transfer.schema';
import { Transaction } from '@/domain/safe/entities/transaction.entity';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import {
  CONFIRMATION_SCHEMA_ID,
  confirmationSchema,
} from '@/domain/safe/entities/schemas/multisig-transaction.schema';

@Injectable()
export class TransactionTypeValidator
  implements IValidator<Transaction>, IPageValidator<Transaction>
{
  private readonly isValidTransactionType: ValidateFunction<Transaction>;
  private readonly isValidPage: ValidateFunction<Page<Transaction>>;

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

    this.jsonSchemaService.getSchema(TRANSFER_SCHEMA_ID, transferSchema);

    this.jsonSchemaService.getSchema(
      ETHEREUM_TRANSACTION_TYPE_SCHEMA_ID,
      ethereumTransactionTypeSchema,
    );

    this.jsonSchemaService.getSchema(
      DATA_DECODED_PARAMETER_SCHEMA_ID,
      dataDecodedParameterSchema,
    );

    this.jsonSchemaService.getSchema(DATA_DECODED_SCHEMA_ID, dataDecodedSchema);

    this.jsonSchemaService.getSchema(
      CONFIRMATION_SCHEMA_ID,
      confirmationSchema,
    );

    this.jsonSchemaService.getSchema(
      MODULE_TRANSACTION_TYPE_SCHEMA_ID,
      moduleTransactionTypeSchema,
    );

    this.jsonSchemaService.getSchema(
      MULTISIG_TRANSACTION_TYPE_SCHEMA_ID,
      multisigTransactionTypeSchema,
    );

    this.isValidTransactionType = this.jsonSchemaService.getSchema(
      TRANSACTION_TYPE_SCHEMA_ID,
      transactionTypeSchema,
    );

    this.isValidPage = this.jsonSchemaService.getSchema(
      TRANSACTION_TYPE_PAGE_SCHEMA_ID,
      transactionTypePageSchema,
    );
  }

  validate(data: unknown): Transaction {
    return this.genericValidator.validate(this.isValidTransactionType, data);
  }

  validatePage(data: unknown): Page<Transaction> {
    return this.genericValidator.validate(this.isValidPage, data);
  }
}
