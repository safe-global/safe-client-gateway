import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../domain/schema/generic.validator';
import { JsonSchemaService } from '../../../domain/schema/json-schema.service';
import { GetDelegateDto } from '../entities/get-delegate.dto.entity';
import { getDelegateDtoSchema } from '../entities/schemas/get-delegate.dto.schema';

@Injectable()
export class GetDelegateDtoValidationPipe
  implements PipeTransform<any, GetDelegateDto>
{
  private readonly isValid: ValidateFunction<GetDelegateDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/delegates/get-delegate.dto.json',
      getDelegateDtoSchema,
    );
  }
  transform(data: any): GetDelegateDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
