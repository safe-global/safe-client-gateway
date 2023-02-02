import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { Transaction } from './entities/transaction.entity';
import { transactionTypeSchema } from './entities/schemas/transaction-type.schema';
import { ethereumTransactionTypeSchema } from './entities/schemas/ethereum-transaction-type.schema';
import { transferSchema } from './entities/schemas/transfer.schema';
import { nativeTokenTransferSchema } from './entities/schemas/native-token-transfer.schema';
import { erc20TransferSchema } from './entities/schemas/erc20-transfer.schema';
import { erc721TransferSchema } from './entities/schemas/erc721-transfer.schema';
import { moduleTransactionTypeSchema } from './entities/schemas/module-transaction-type.schema';
import { multisigTransactionTypeSchema } from './entities/schemas/multisig-transaction-type.schema';
import {
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';

@Injectable()
export class TransactionTypeValidator implements IValidator<Transaction> {
  private readonly isValidTransactionType: ValidateFunction<Transaction>;

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
  }

  validate(data: unknown): Transaction {
    return this.genericValidator.validate(this.isValidTransactionType, data);
  }
}
