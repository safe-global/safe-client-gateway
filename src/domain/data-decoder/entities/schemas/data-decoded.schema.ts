import { Schema } from 'ajv';
import { z } from 'zod';

export const DataDecodedParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  // z.unknown() makes the property optional but it should be defined
  value: z.custom<Required<unknown>>((value) => value !== undefined),
  valueDecoded: z
    .union([z.record(z.unknown()), z.array(z.record(z.unknown()))])
    .optional(),
});

export const DataDecodedSchema = z.object({
  method: z.string(),
  parameters: z.array(DataDecodedParameterSchema).nullable(),
});

// TODO: Remove after creation, module, multisig and transaction type are migrated to zod
export const DATA_DECODED_PARAMETER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/data-decoded/data-decoded-parameter.json';

export const dataDecodedParameterSchema: Schema = {
  $id: DATA_DECODED_PARAMETER_SCHEMA_ID,
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

export const DATA_DECODED_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/data-decoded/data-decoded.json';

export const dataDecodedSchema: Schema = {
  $id: DATA_DECODED_SCHEMA_ID,
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
