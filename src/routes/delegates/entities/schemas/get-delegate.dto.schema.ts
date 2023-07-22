import { JSONSchemaType } from 'ajv';
import { GetDelegateDto } from '../get-delegate.dto.entity';

export const GET_DELEGATE_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/delegates/get-delegate.dto.json';

export const getDelegateDtoSchema: JSONSchemaType<GetDelegateDto> = {
  $id: GET_DELEGATE_DTO_SCHEMA_ID,
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
