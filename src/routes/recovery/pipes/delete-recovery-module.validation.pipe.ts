import { Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { DeleteRecoveryModuleDto } from '@/routes/recovery/entities/delete-recovery-module.dto.entity';
import {
  DELETE_RECOVERY_MODULE_DTO_SCHEMA_ID,
  deleteRecoveryModuleDtoSchema,
} from '@/routes/recovery/entities/schemas/delete-recovery-module.dto.schema';

@Injectable()
export class DeleteRecoveryModuleDtoValidationPipe
  implements PipeTransform<unknown, DeleteRecoveryModuleDto>
{
  private readonly isValid: ValidateFunction<DeleteRecoveryModuleDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      DELETE_RECOVERY_MODULE_DTO_SCHEMA_ID,
      deleteRecoveryModuleDtoSchema,
    );
  }
  transform(data: unknown): DeleteRecoveryModuleDto {
    return this.genericValidator.validate(this.isValid, data);
  }
}
