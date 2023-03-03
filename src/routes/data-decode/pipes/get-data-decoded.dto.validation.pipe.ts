import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../../validation/providers/json-schema.service';
import { ValidationErrorFactory } from '../../../validation/providers/validation-error-factory';
import { isHex } from '../../common/utils/utils';
import { GetDataDecodedDto } from '../entities/get-data-decoded.dto.entity';
import { getDataDecodedDtoSchema } from '../entities/schemas/get-data-decoded.dto.schema';

@Injectable()
export class GetDataDecodedDtoValidationPipe
  implements PipeTransform<any, GetDataDecodedDto>
{
  private readonly isValid: ValidateFunction<GetDataDecodedDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
    private readonly validationErrorFactory: ValidationErrorFactory,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/delegates/get-data-decoded.dto.json',
      getDataDecodedDtoSchema,
    );
  }
  transform(data: any): GetDataDecodedDto {
    try {
      this.genericValidator.validate(this.isValid, data);
      if (!this.isGetDataDecodeDto(data)) {
        throw this.validationErrorFactory.from([]);
      }
      return data as GetDataDecodedDto;
    } catch (err) {
      err.status = HttpStatus.BAD_REQUEST;
      throw err;
    }
  }

  private isGetDataDecodeDto(dto: GetDataDecodedDto): dto is GetDataDecodedDto {
    return isHex(dto.data) && isHex(dto.to);
  }
}
