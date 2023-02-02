import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { MasterCopy } from './entities/master-copies.entity';
import { masterCopySchema } from './entities/schemas/master-copy.schema';

@Injectable()
export class MasterCopyValidator implements IValidator<MasterCopy> {
  private readonly isValidMasterCopy: ValidateFunction<MasterCopy>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidMasterCopy = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/chains/master-copy.json',
      masterCopySchema,
    );
  }

  validate(data: unknown): MasterCopy {
    return this.genericValidator.validate(this.isValidMasterCopy, data);
  }
}
