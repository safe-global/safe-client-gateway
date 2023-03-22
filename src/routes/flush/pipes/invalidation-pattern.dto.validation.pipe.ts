import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { InvalidationPatternDto } from '../entities/invalidation-pattern.dto.entity';
import { invalidationPatternDtoSchema } from '../entities/schemas/invalidation-pattern.dto.schema';

@Injectable()
export class InvalidationPatternDtoValidationPipe
  implements PipeTransform<any, InvalidationPatternDto>
{
  private readonly isValid: ValidateFunction<InvalidationPatternDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/delegates/invalidation-pattern.dto.json',
      invalidationPatternDtoSchema,
    );
  }
  transform(data: any): InvalidationPatternDto {
    try {
      data.invalidate = data.invalidate?.toUpperCase();
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
