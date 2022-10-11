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
    this.isValidMasterCopy = this.jsonSchemaService.compile(
      masterCopySchema,
    ) as ValidateFunction<MasterCopy>;
  }

  validate(data: unknown): MasterCopy {
    this.genericValidator.execute(this.isValidMasterCopy, data);
    return data as MasterCopy;
  }
}
