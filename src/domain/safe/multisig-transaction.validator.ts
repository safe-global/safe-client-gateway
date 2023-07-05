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
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import {
  confirmationSchema,
  multisigTransactionPageSchema,
  multisigTransactionSchema,
} from './entities/schemas/multisig-transaction.schema';

@Injectable()
export class MultisigTransactionValidator
  implements
    IValidator<MultisigTransaction>,
    IPageValidator<MultisigTransaction>
{
  private readonly isValidMultisigTransaction: ValidateFunction<MultisigTransaction>;
  private readonly isValidPage: ValidateFunction<Page<MultisigTransaction>>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded-parameter.json',
      dataDecodedParameterSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded.json',
      dataDecodedSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/confirmation.json',
      confirmationSchema,
    );

    this.isValidMultisigTransaction = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/multisig-transaction.json',
      multisigTransactionSchema,
    );

    this.isValidPage = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/multisig-transaction-page.json',
      multisigTransactionPageSchema,
    );
  }

  validate(data: unknown): MultisigTransaction {
    return this.genericValidator.validate(
      this.isValidMultisigTransaction,
      data,
    );
  }

  validatePage(data: unknown): Page<MultisigTransaction> {
    return this.genericValidator.validate(this.isValidPage, data);
  }
}
