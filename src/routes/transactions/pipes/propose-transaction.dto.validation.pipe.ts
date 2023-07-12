import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { ProposeTransactionDto } from '../entities/propose-transaction.dto.entity';
import {
  PROPOSE_TRANSACTION_DTO_SCHEMA_ID,
  proposeTransactionDtoSchema,
} from '../entities/schemas/propose-transaction.dto.schema';

@Injectable()
export class ProposeTransactionDtoValidationPipe
  implements PipeTransform<any, ProposeTransactionDto>
{
  private readonly isValid: ValidateFunction<ProposeTransactionDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      PROPOSE_TRANSACTION_DTO_SCHEMA_ID,
      proposeTransactionDtoSchema,
    );
  }
  transform(data: any): ProposeTransactionDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
