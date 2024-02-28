import { RelayLegacyDto } from '@/routes/relay/entities/relay.legacy.dto.entity';
import {
  RELAY_LEGACY_DTO_SCHEMA_ID,
  relayLegacyDtoSchema,
} from '@/routes/relay/entities/schemas/relay.legacy.dto.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';

@Injectable()
export class RelayLegacyDtoValidationPipe
  implements PipeTransform<unknown, RelayLegacyDto>
{
  private readonly isValid: ValidateFunction<RelayLegacyDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      RELAY_LEGACY_DTO_SCHEMA_ID,
      relayLegacyDtoSchema,
    );
  }
  transform(data: unknown): RelayLegacyDto {
    return this.genericValidator.validate(this.isValid, data);
  }
}
