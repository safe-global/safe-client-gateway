import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { PreviewTransactionDto } from '../entities/preview-transaction.dto.entity';
import {
  PREVIEW_TRANSACTION_DTO_SCHEMA_ID,
  previewTransactionDtoSchema,
} from '../entities/schemas/preview-transaction.dto.schema';

@Injectable()
export class PreviewTransactionDtoValidationPipe
  implements PipeTransform<any, PreviewTransactionDto>
{
  private readonly isValid: ValidateFunction<PreviewTransactionDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      PREVIEW_TRANSACTION_DTO_SCHEMA_ID,
      previewTransactionDtoSchema,
    );
  }
  transform(data: any): PreviewTransactionDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
