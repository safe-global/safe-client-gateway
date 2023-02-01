import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import {
  confirmationSchema,
  multisigTransactionSchema,
} from './entities/schemas/multisig-transaction.schema';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import {
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';

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
