import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { Contract } from './entities/contract.entity';
import { contractSchema } from './entities/schemas/contract.schema';

@Injectable()
export class ContractsValidator implements IValidator<Contract> {
  private readonly isValidContract: ValidateFunction<Contract>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidContract = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/contracts/contract.json',
      contractSchema,
    );
  }

  validate(data: unknown): Contract {
    return this.genericValidator.validate(this.isValidContract, data);
  }
}
