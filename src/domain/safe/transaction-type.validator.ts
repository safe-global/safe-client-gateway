import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import {
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';
import { Page } from '../entities/page.entity';
import { IPageValidator } from '../interfaces/page-validator.interface';
import { IValidator } from '../interfaces/validator.interface';
import { erc20TransferSchema } from './entities/schemas/erc20-transfer.schema';
import { erc721TransferSchema } from './entities/schemas/erc721-transfer.schema';
import { ethereumTransactionTypeSchema } from './entities/schemas/ethereum-transaction-type.schema';
import { moduleTransactionTypeSchema } from './entities/schemas/module-transaction-type.schema';
import { multisigTransactionTypeSchema } from './entities/schemas/multisig-transaction-type.schema';
import { nativeTokenTransferSchema } from './entities/schemas/native-token-transfer.schema';
import {
  transactionTypePageSchema,
  transactionTypeSchema,
} from './entities/schemas/transaction-type.schema';
import { transferSchema } from './entities/schemas/transfer.schema';
import { Transaction } from './entities/transaction.entity';

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

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/transfer.json',
      transferSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/ethereum-transaction-type.json',
      ethereumTransactionTypeSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded-parameter.json',
      dataDecodedParameterSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded.json',
      dataDecodedSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/module-transaction-type.json',
      moduleTransactionTypeSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/multisig-transaction-type.json',
      multisigTransactionTypeSchema,
    );

    this.isValidTransactionType = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/transaction-type.json',
      transactionTypeSchema,
    );

    this.isValidPage = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/transaction-type-page.json',
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
