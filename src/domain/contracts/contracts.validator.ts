import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
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
