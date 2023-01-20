import { Schema } from 'ajv';

export const dataDecodedParameterSchema: Schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    value: {},
    valueDecoded: { type: ['object', 'array', 'null'] },
  },
  required: ['name', 'type', 'value'],
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
