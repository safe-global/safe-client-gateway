import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { CreateMessageDto } from '../entities/create-message.dto.entity';
import {
  CREATE_MESSAGE_DTO_SCHEMA_ID,
  createMessageDtoSchema,
} from '../entities/schemas/create-message.dto.schema';

@Injectable()
export class CreateMessageDtoValidationPipe
  implements PipeTransform<any, CreateMessageDto>
{
  private readonly isValid: ValidateFunction<CreateMessageDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      CREATE_MESSAGE_DTO_SCHEMA_ID,
      createMessageDtoSchema,
    );
  }

  transform(data: any): CreateMessageDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }
}
