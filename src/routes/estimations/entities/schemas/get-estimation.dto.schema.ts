import { JSONSchemaType } from 'ajv';
import { GetEstimationDto } from '../get-estimation.dto.entity';

export const getEstimationDtoSchema: JSONSchemaType<GetEstimationDto> = {
  $id: 'https://safe-client.safe.global/schemas/delegates/get-estimation.dto.json',
  type: 'object',
  properties: {
    to: { type: 'string' },
    value: { type: 'number' },
    data: { type: 'string', nullable: true },
    operation: { type: 'number', enum: [0, 1] },
  },
  required: ['to', 'value'],
};
