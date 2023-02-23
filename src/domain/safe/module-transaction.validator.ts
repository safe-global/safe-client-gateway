import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import {
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';
import { IValidator } from '../interfaces/validator.interface';
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
    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded-parameter.json',
      dataDecodedParameterSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/data-decoded/data-decoded.json',
      dataDecodedSchema,
    );

    this.isValidModuleTransaction = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe/module-transaction.json',
      moduleTransactionSchema,
    );
  }

  validate(data: unknown): ModuleTransaction {
    return this.genericValidator.validate(this.isValidModuleTransaction, data);
  }
}
