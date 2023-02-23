import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { DeleteDelegateDto } from '../entities/delete-delegate.dto.entity';
import { deleteDelegateDtoSchema } from '../entities/schemas/delete-delegate.dto.schema';

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
      'https://safe-client.safe.global/schemas/delegates/delete-delegate.dto.json',
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
