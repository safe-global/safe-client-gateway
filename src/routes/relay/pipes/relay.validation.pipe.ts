import { RelayDto } from '@/routes/relay/entities/relay.dto.entity';
import {
  RELAY_DTO_SCHEMA_ID,
  relayDtoSchema,
} from '@/routes/relay/entities/schemas/relay.dto.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';

@Injectable()
export class RelayDtoValidationPipe
  implements PipeTransform<unknown, RelayDto>
{
  private readonly isValid: ValidateFunction<RelayDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      RELAY_DTO_SCHEMA_ID,
      relayDtoSchema,
    );
  }
  transform(data: unknown): RelayDto {
    return this.genericValidator.validate(this.isValid, data);
  }
}
