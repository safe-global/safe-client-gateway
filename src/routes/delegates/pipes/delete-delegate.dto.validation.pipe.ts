import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { DeleteDelegateDto } from '../entities/delete-delegate.dto.entity';
import {
  DELETE_DELEGATE_DTO_SCHEMA_ID,
  deleteDelegateDtoSchema,
} from '../entities/schemas/delete-delegate.dto.schema';

@Injectable()
export class DeleteDelegateDtoValidationPipe
  implements PipeTransform<any, DeleteDelegateDto>
{
  private readonly isValid: ValidateFunction<DeleteDelegateDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      DELETE_DELEGATE_DTO_SCHEMA_ID,
      deleteDelegateDtoSchema,
    );
  }
  transform(data: any): DeleteDelegateDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
