import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { Contract } from './entities/contract.entity';
import { contractSchema } from './entities/schemas/contract.schema';

@Injectable()
export class ContractsValidator implements IValidator<Contract> {
  private readonly isValidContract: ValidateFunction<Contract>;

  constructor(
    private readonly simpleValidator: SimpleValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidContract = this.jsonSchemaService.compile(
      contractSchema,
    ) as ValidateFunction<Contract>;
  }

  validate(data: unknown): Contract {
    this.simpleValidator.execute(this.isValidContract, data);
    return data as Contract;
  }
}
