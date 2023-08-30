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
import { IValidator } from '../interfaces/validator.interface';
import { CreationTransaction } from './entities/creation-transaction.entity';
import {
  CREATION_TRANSACTION_SCHEMA_ID,
  creationTransactionSchema,
} from './entities/schemas/creation-transaction.schema';

@Injectable()
export class CreationTransactionValidator
  implements IValidator<CreationTransaction>
{
  private readonly isValidCreationTransaction: ValidateFunction<CreationTransaction>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      DATA_DECODED_PARAMETER_SCHEMA_ID,
      dataDecodedParameterSchema,
    );

    this.jsonSchemaService.getSchema(DATA_DECODED_SCHEMA_ID, dataDecodedSchema);

    this.isValidCreationTransaction = this.jsonSchemaService.getSchema(
      CREATION_TRANSACTION_SCHEMA_ID,
      creationTransactionSchema,
    );
  }

  validate(data: unknown): CreationTransaction {
    return this.genericValidator.validate(
      this.isValidCreationTransaction,
      data,
    );
  }
}
