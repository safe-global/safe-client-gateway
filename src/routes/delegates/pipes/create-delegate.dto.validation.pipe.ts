import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../domain/schema/generic.validator';
import { JsonSchemaService } from '../../../domain/schema/json-schema.service';
import { CreateDelegateDto } from '../entities/create-delegate.dto.entity';
import { createDelegateDtoSchema } from '../entities/schemas/create-delegate.dto.schema';

@Injectable()
export class CreateDelegateDtoValidationPipe
  implements PipeTransform<any, CreateDelegateDto>
{
  private readonly isValid: ValidateFunction<CreateDelegateDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/delegates/create-delegate.dto.json',
      createDelegateDtoSchema,
    );
  }
  transform(data: any): CreateDelegateDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
