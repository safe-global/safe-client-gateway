import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { multisigTransactionSchema } from './entities/schemas/multisig-transaction.schema';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { dataDecodedSchema } from '../data-decoder/entities/schemas/data-decoded.schema';

@Injectable()
export class MultisigTransactionValidator
  implements IValidator<MultisigTransaction>
{
  private readonly isValidMultisigTransaction: ValidateFunction<MultisigTransaction>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.addSchema(dataDecodedSchema, 'dataDecodedSchema');
    this.isValidMultisigTransaction = this.jsonSchemaService.compile(
      multisigTransactionSchema,
    ) as ValidateFunction<MultisigTransaction>;
  }

  validate(data: unknown): MultisigTransaction {
    return this.genericValidator.validate(
      this.isValidMultisigTransaction,
      data,
    );
  }
}
