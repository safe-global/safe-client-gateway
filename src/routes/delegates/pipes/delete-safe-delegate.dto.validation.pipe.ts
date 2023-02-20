import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../domain/schema/generic.validator';
import { JsonSchemaService } from '../../../domain/schema/json-schema.service';
import { DeleteSafeDelegateDto } from '../entities/delete-safe-delegate.dto.entity';
import { deleteSafeDelegateDtoSchema } from '../entities/schemas/delete-safe-delegate.dto.schema';

@Injectable()
export class DeleteSafeDelegateDtoValidationPipe
  implements PipeTransform<any, DeleteSafeDelegateDto>
{
  private readonly isValid: ValidateFunction<DeleteSafeDelegateDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/delegates/delete-safe-delegate.dto.json',
      deleteSafeDelegateDtoSchema,
    );
  }
  transform(data: any): DeleteSafeDelegateDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
