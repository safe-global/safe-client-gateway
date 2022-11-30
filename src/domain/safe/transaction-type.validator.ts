import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { Transaction } from './entities/transaction.entity';
import { transactionTypeSchema } from './entities/schemas/transaction-type.schema';

@Injectable()
export class TransactionTypeValidator implements IValidator<Transaction> {
  private readonly isValidTransactionType: ValidateFunction<Transaction>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidTransactionType = this.jsonSchemaService.compile(
      transactionTypeSchema,
    ) as ValidateFunction<Transaction>;
  }

  validate(data: unknown): Transaction {
    return this.genericValidator.validate(this.isValidTransactionType, data);
  }
}
