import { JSONSchemaType } from 'ajv';
import { Estimation } from '../estimation.entity';

export const ESTIMATION_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/estimations/estimation.json';

export const estimationSchema: JSONSchemaType<Estimation> = {
  $id: ESTIMATION_SCHEMA_ID,
  type: 'object',
  properties: {
    safeTxGas: { type: 'string' },
  },
  required: ['safeTxGas'],
};
