import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { InvalidationPatternDto } from '../entities/invalidation-pattern.dto.entity';
import {
  INVALIDATION_PATTERN_DETAIL_SCHEMA_ID,
  INVALIDATION_PATTERN_DTO_SCHEMA_ID,
  invalidationPatternDetailSchema,
  invalidationPatternDtoSchema,
} from '../entities/schemas/invalidation-pattern.dto.schema';

@Injectable()
export class InvalidationPatternDtoValidationPipe
  implements PipeTransform<any, InvalidationPatternDto>
{
  private readonly isValid: ValidateFunction<InvalidationPatternDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      INVALIDATION_PATTERN_DETAIL_SCHEMA_ID,
      invalidationPatternDetailSchema,
    );
    this.isValid = this.jsonSchemaService.getSchema(
      INVALIDATION_PATTERN_DTO_SCHEMA_ID,
      invalidationPatternDtoSchema,
    );
  }
  transform(data: any): InvalidationPatternDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
