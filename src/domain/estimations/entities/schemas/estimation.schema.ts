import { Schema } from 'ajv';

export const estimationSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/estimations/estimation.json',
  type: 'object',
  properties: {
    safeTxGas: { type: 'string' },
  },
  required: ['safeTxGas'],
};
