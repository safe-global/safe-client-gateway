import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { AddConfirmationDto } from '../entities/add-confirmation.dto';
import { addConfirmationDtoSchema } from '../entities/schemas/add-confirmation.dto.schema';

@Injectable()
export class AddConfirmationDtoValidationPipe
  implements PipeTransform<any, AddConfirmationDto>
{
  private readonly isValid: ValidateFunction<AddConfirmationDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/transactions/add-confirmation.dto.json',
      addConfirmationDtoSchema,
    );
  }
  transform(data: any): AddConfirmationDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
