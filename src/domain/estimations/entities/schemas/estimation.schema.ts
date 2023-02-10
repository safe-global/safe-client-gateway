import { JSONSchemaType } from 'ajv';
import { Estimation } from '../estimation.entity';

export const estimationSchema: JSONSchemaType<Estimation> = {
  $id: 'https://safe-client.safe.global/schemas/estimations/estimation.json',
  type: 'object',
  properties: {
    safeTxGas: { type: 'string' },
  },
  required: ['safeTxGas'],
};
