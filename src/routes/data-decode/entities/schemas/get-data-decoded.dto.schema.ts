import { JSONSchemaType } from 'ajv';
import { HEX_PATTERN } from '@/validation/patterns';
import { GetDataDecodedDto } from '@/routes/data-decode/entities/get-data-decoded.dto.entity';

export const GET_DATA_DECODED_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/delegates/get-data-decoded.dto.json';

export const getDataDecodedDtoSchema: JSONSchemaType<GetDataDecodedDto> = {
  $id: GET_DATA_DECODED_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    data: { type: 'string', pattern: HEX_PATTERN },
    to: { type: 'string', pattern: HEX_PATTERN, nullable: true },
  },
  required: ['data'],
};
