import { JSONSchemaType } from 'ajv';
import { GetEstimationDto } from '../get-estimation.dto.entity';

export const GET_ESTIMATION_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/estimations/get-estimation.dto.json';

export const getEstimationDtoSchema: JSONSchemaType<GetEstimationDto> = {
  $id: GET_ESTIMATION_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    to: { type: 'string' },
    value: { type: 'string' },
    data: { oneOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
    operation: { type: 'number', enum: [0, 1] },
  },
  required: ['to', 'value'],
};
