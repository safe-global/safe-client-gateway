import { Schema } from 'ajv';

export const dataDecodedParameterSchema: Schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    value: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    valueDecoded: { type: ['object', 'array', 'null'] },
  },
  required: ['name', 'value'],
  additionalProperties: true,
};

export const dataDecodedSchema: Schema = {
  type: 'object',
  properties: {
    method: { type: 'string' },
    parameters: {
      anyOf: [
        { type: 'null' },
        { type: 'array', items: { $ref: 'dataDecodedParameter' } },
      ],
    },
  },
};
