import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { GenericValidator } from '../schema/generic.validator';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { moduleTransactionSchema } from './entities/schemas/module-transaction.schema';
import {
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';

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
