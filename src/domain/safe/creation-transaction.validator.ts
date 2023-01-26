import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { CreationTransaction } from './entities/creation-transaction.entity';
import { creationTransactionSchema } from './entities/schemas/creation-transaction.schema';

@Injectable()
export class CreationTransactionValidator
  implements IValidator<CreationTransaction>
{
  private readonly isValidCreationTransaction: ValidateFunction<CreationTransaction>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidCreationTransaction = this.jsonSchemaService.compile(
      creationTransactionSchema,
    ) as ValidateFunction<CreationTransaction>;
  }

  validate(data: unknown): CreationTransaction {
    return this.genericValidator.validate(
      this.isValidCreationTransaction,
      data,
    );
  }
}
