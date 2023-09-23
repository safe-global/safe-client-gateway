import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import {
  DATA_DECODED_PARAMETER_SCHEMA_ID,
  DATA_DECODED_SCHEMA_ID,
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';
import { Page } from '../entities/page.entity';
import { IPageValidator } from '../interfaces/page-validator.interface';
import { IValidator } from '../interfaces/validator.interface';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import {
  CONFIRMATION_SCHEMA_ID,
  MULTISIG_TRANSACTION_PAGE_SCHEMA_ID,
  MULTISIG_TRANSACTION_SCHEMA_ID,
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
      DATA_DECODED_PARAMETER_SCHEMA_ID,
      dataDecodedParameterSchema,
    );

    this.jsonSchemaService.getSchema(DATA_DECODED_SCHEMA_ID, dataDecodedSchema);

    this.jsonSchemaService.getSchema(
      CONFIRMATION_SCHEMA_ID,
      confirmationSchema,
    );

    this.isValidMultisigTransaction = this.jsonSchemaService.getSchema(
      MULTISIG_TRANSACTION_SCHEMA_ID,
      multisigTransactionSchema,
    );

    this.isValidPage = this.jsonSchemaService.getSchema(
      MULTISIG_TRANSACTION_PAGE_SCHEMA_ID,
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
