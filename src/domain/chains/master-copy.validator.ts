import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { MasterCopy } from '@/domain/chains/entities/master-copies.entity';
import {
  MASTER_COPY_SCHEMA_ID,
  masterCopySchema,
} from '@/domain/chains/entities/schemas/master-copy.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class MasterCopyValidator implements IValidator<MasterCopy> {
  private readonly isValidMasterCopy: ValidateFunction<MasterCopy>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidMasterCopy = this.jsonSchemaService.getSchema(
      MASTER_COPY_SCHEMA_ID,
      masterCopySchema,
    );
  }

  validate(data: unknown): MasterCopy {
    return this.genericValidator.validate(this.isValidMasterCopy, data);
  }
}
