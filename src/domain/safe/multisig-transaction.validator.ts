import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import {
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';
import { IValidator } from '../interfaces/validator.interface';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import {
  confirmationSchema,
  multisigTransactionSchema,
} from './entities/schemas/multisig-transaction.schema';

@Injectable()
export class MultisigTransactionValidator
  implements IValidator<MultisigTransaction>
{
  private readonly isValidMultisigTransaction: ValidateFunction<MultisigTransaction>;

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
  }

  validate(data: unknown): MultisigTransaction {
    return this.genericValidator.validate(
      this.isValidMultisigTransaction,
      data,
    );
  }
}
