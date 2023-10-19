import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import {
  CONTRACT_SCHEMA_ID,
  contractSchema,
} from '@/domain/contracts/entities/schemas/contract.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class ContractsValidator implements IValidator<Contract> {
  private readonly isValidContract: ValidateFunction<Contract>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidContract = this.jsonSchemaService.getSchema(
      CONTRACT_SCHEMA_ID,
      contractSchema,
    );
  }

  validate(data: unknown): Contract {
    return this.genericValidator.validate(this.isValidContract, data);
  }
}
