import { JSONSchemaType } from 'ajv';
import { GetDataDecodedDto } from '../get-data-decoded.dto.entity';

export const getDataDecodedDtoSchema: JSONSchemaType<GetDataDecodedDto> = {
  $id: 'https://safe-client.safe.global/schemas/delegates/get-data-decoded.dto.json',
  type: 'object',
  properties: {
    data: { type: 'string' },
    to: { type: 'string', nullable: true },
  },
  required: ['data'],
};
