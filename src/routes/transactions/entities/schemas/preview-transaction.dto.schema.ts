import { JSONSchemaType } from 'ajv';
import { PreviewTransactionDto } from '../preview-transaction.dto.entity';

export const PREVIEW_TRANSACTION_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/transactions/preview-transaction.dto.json';

export const previewTransactionDtoSchema: JSONSchemaType<PreviewTransactionDto> =
  {
    $id: PREVIEW_TRANSACTION_DTO_SCHEMA_ID,
    type: 'object',
    properties: {
      to: { type: 'string' },
      data: { oneOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
      value: { type: 'string' },
      operation: { type: 'number', enum: [0, 1] },
    },
    required: ['to', 'value', 'operation'],
  };
