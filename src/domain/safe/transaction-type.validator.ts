import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { TransactionType } from './entities/transaction-type.entity';
import { transactionTypeSchema } from './entities/schemas/transaction-type.schema';

@Injectable()
export class TransactionTypeValidator implements IValidator<TransactionType> {
  private readonly isValidTransactionType: ValidateFunction<TransactionType>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidTransactionType = this.jsonSchemaService.compile(
      transactionTypeSchema,
    ) as ValidateFunction<TransactionType>;
  }

  validate(data: unknown): TransactionType {
    return this.genericValidator.validate(this.isValidTransactionType, data);
  }
}
