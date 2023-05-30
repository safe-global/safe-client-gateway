import { Schema } from 'ajv';

export const dataDecodedParameterSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/data-decoded/data-decoded-parameter.json',
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    // bypassing validation for 'value' property, it has type 'any' in the source (Transaction Service)
    value: {},
    valueDecoded: { type: ['object', 'array', 'null'] },
  },
  required: ['name', 'type', 'value'],
};

export const dataDecodedSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/data-decoded/data-decoded.json',
  type: 'object',
  properties: {
    method: { type: 'string' },
    parameters: {
      anyOf: [
        { type: 'null' },
        { type: 'array', items: { $ref: 'data-decoded-parameter.json' } },
      ],
    },
  },
};
