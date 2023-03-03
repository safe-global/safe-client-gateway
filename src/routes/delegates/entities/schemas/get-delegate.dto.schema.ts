import { JSONSchemaType } from 'ajv';
import { GetDelegateDto } from '../get-delegate.dto.entity';

export const getDelegateDtoSchema: JSONSchemaType<GetDelegateDto> = {
  $id: 'https://safe-client.safe.global/schemas/delegates/get-delegate.dto.json',
  type: 'object',
  properties: {
    safe: { type: 'string', nullable: true },
    delegate: { type: 'string', nullable: true },
    delegator: { type: 'string', nullable: true },
    label: { type: 'string', nullable: true },
  },
  oneOf: [
    { required: ['safe'] },
    { required: ['delegate'] },
    { required: ['delegator'] },
    { required: ['label'] },
  ],
};
