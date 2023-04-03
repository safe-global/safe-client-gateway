import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { GetEstimationDto } from '../entities/get-estimation.dto.entity';
import { getEstimationDtoSchema } from '../entities/schemas/get-estimation.dto.schema';

@Injectable()
export class GetEstimationDtoValidationPipe
  implements PipeTransform<any, GetEstimationDto>
{
  private readonly isValid: ValidateFunction<GetEstimationDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/delegates/get-estimation.dto.json',
      getEstimationDtoSchema,
    );
  }
  transform(data: any): GetEstimationDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
