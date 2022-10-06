import { Injectable } from '@nestjs/common';
import { ValidateFunction, DefinedError } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { Contract } from './entities/contract.entity';
import { contractSchema } from './entities/schemas/contract.schema';

@Injectable()
export class ContractsValidator implements IValidator<Contract> {
  private readonly isValidContract: ValidateFunction<Contract>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidContract = this.jsonSchemaService.compile(
      contractSchema,
    ) as ValidateFunction<Contract>;
  }

  validate(data: unknown): Contract {
    if (!this.isValidContract(data)) {
      const errors = this.isValidContract.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as Contract;
  }
}
