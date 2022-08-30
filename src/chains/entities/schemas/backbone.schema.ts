import Ajv, { JSONSchemaType } from 'ajv';
import { Backbone } from '../backbone.entity';

const ajv = new Ajv();

const backboneSchema: JSONSchemaType<Backbone> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    version: { type: 'string'},
    api_version: { type: 'string' },
    secure: { type: 'boolean' },
    host: { type: 'string' },
    headers: { type: 'array', items: { type: 'string' } },
    settings: { type: 'object' },
  },
  required: [],
  additionalProperties: false,
};

const isValidBackbone = ajv.compile(backboneSchema);

export default isValidBackbone;
