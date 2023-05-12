import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { CreateConfirmationDto } from '../entities/create-confirmation.dto';
import { createConfirmationDtoSchema } from '../entities/schemas/create-confirmation.dto.schema';

@Injectable()
export class CreateConfirmationDtoValidationPipe
  implements PipeTransform<any, CreateConfirmationDto>
{
  private readonly isValid: ValidateFunction<CreateConfirmationDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/transactions/create-confirmation.dto.json',
      createConfirmationDtoSchema,
    );
  }
  transform(data: any): CreateConfirmationDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
