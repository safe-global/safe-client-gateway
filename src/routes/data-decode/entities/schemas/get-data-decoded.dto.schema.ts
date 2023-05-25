import { JSONSchemaType } from 'ajv';
import { GetDataDecodedDto } from '../get-data-decoded.dto.entity';
import { HEX_PATTERN } from '../../../../validation/patterns';

export const getDataDecodedDtoSchema: JSONSchemaType<GetDataDecodedDto> = {
  $id: 'https://safe-client.safe.global/schemas/delegates/get-data-decoded.dto.json',
  type: 'object',
  properties: {
    data: { type: 'string', pattern: HEX_PATTERN },
    to: { type: 'string', pattern: HEX_PATTERN, nullable: true },
  },
  required: ['data'],
};
