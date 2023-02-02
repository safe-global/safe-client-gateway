import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { CreationTransaction } from './entities/creation-transaction.entity';
import { creationTransactionSchema } from './entities/schemas/creation-transaction.schema';
import {
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';

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
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded-parameter.json',
      dataDecodedParameterSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded.json',
      dataDecodedSchema,
    );

    this.isValidCreationTransaction = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/creation-transaction.json',
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
