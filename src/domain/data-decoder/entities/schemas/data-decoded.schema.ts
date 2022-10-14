import { JSONSchemaType, Schema } from 'ajv';
import { DataDecodedParameter } from '../data-decoded.entity';

export const dataDecodedParameterSchema: JSONSchemaType<DataDecodedParameter> =
  {
    type: 'object',
    properties: {
      name: { type: 'string' },
      param_type: { type: 'string' },
      value: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      value_decoded: { type: 'object', nullable: true },
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
