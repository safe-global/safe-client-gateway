import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { GenericValidator } from '../schema/generic.validator';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { moduleTransactionSchema } from './entities/schemas/module-transaction.schema';

@Injectable()
export class ModuleTransactionValidator
  implements IValidator<ModuleTransaction>
{
  private readonly isValidModuleTransaction: ValidateFunction<ModuleTransaction>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidModuleTransaction = this.jsonSchemaService.compile(
      moduleTransactionSchema,
    ) as ValidateFunction<ModuleTransaction>;
  }

  validate(data: unknown): ModuleTransaction {
    return this.genericValidator.validate(this.isValidModuleTransaction, data);
  }
}
