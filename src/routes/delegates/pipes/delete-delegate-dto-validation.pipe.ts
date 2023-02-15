import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../domain/schema/generic.validator';
import { JsonSchemaService } from '../../../domain/schema/json-schema.service';
import { DeleteDelegateDto } from '../entities/delete-delegate.entity';
import { deleteDelegateDtoSchema } from '../entities/schemas/delete-delegate.schema';

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
      'https://safe-client.safe.global/schemas/delegates/delete-delegate.json',
      deleteDelegateDtoSchema,
    );
  }
  transform(data: any): DeleteDelegateDto {
    return this.genericValidator.validate(
      this.isValid,
      data,
      HttpStatus.BAD_REQUEST,
    );
  }
}
