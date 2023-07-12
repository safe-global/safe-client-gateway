import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import {
  DATA_DECODED_PARAMETER_SCHEMA_ID,
  DATA_DECODED_SCHEMA_ID,
  dataDecodedParameterSchema,
  dataDecodedSchema,
} from '../data-decoder/entities/schemas/data-decoded.schema';
import { Page } from '../entities/page.entity';
import { IPageValidator } from '../interfaces/page-validator.interface';
import { IValidator } from '../interfaces/validator.interface';
import { ModuleTransaction } from './entities/module-transaction.entity';
import {
  MODULE_TRANSACTION_PAGE_SCHEMA_ID,
  MODULE_TRANSACTION_SCHEMA_ID,
  moduleTransactionPageSchema,
  moduleTransactionSchema,
} from './entities/schemas/module-transaction.schema';

@Injectable()
export class ModuleTransactionValidator
  implements IValidator<ModuleTransaction>, IPageValidator<ModuleTransaction>
{
  private readonly isValidModuleTransaction: ValidateFunction<ModuleTransaction>;
  private readonly isValidPage: ValidateFunction<Page<ModuleTransaction>>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      DATA_DECODED_PARAMETER_SCHEMA_ID,
      dataDecodedParameterSchema,
    );

    this.jsonSchemaService.getSchema(DATA_DECODED_SCHEMA_ID, dataDecodedSchema);

    this.isValidModuleTransaction = this.jsonSchemaService.getSchema(
      MODULE_TRANSACTION_SCHEMA_ID,
      moduleTransactionSchema,
    );

    this.isValidPage = this.jsonSchemaService.getSchema(
      MODULE_TRANSACTION_PAGE_SCHEMA_ID,
      moduleTransactionPageSchema,
    );
  }

  validate(data: unknown): ModuleTransaction {
    return this.genericValidator.validate(this.isValidModuleTransaction, data);
  }

  validatePage(data: unknown): Page<ModuleTransaction> {
    return this.genericValidator.validate(this.isValidPage, data);
  }
}
