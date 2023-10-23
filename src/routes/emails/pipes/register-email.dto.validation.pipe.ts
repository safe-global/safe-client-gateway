import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { RegisterEmailDto } from '@/routes/emails/entities/register-email.dto.entity';
import {
  REGISTER_EMAIL_DTO_SCHEMA_ID,
  registerEmailDtoSchema,
} from '@/routes/emails/entities/schemas/register-email.dto.schema';

@Injectable()
export class RegisterEmailDtoValidationPipe
  implements PipeTransform<any, RegisterEmailDto>
{
  private readonly isValid: ValidateFunction<RegisterEmailDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      REGISTER_EMAIL_DTO_SCHEMA_ID,
      registerEmailDtoSchema,
    );
  }

  transform(data: unknown): RegisterEmailDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
