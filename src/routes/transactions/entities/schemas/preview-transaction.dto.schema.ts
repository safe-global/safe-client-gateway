import { JSONSchemaType } from 'ajv';
import { PreviewTransactionDto } from '../preview-transaction.dto.entity';

export const previewTransactionDtoSchema: JSONSchemaType<PreviewTransactionDto> =
  {
    $id: 'https://safe-client.safe.global/schemas/transactions/preview-transaction.dto.json',
    type: 'object',
    properties: {
      to: { type: 'string' },
      data: { type: 'string', nullable: true },
      value: { type: 'string' },
      operation: { type: 'number', enum: [0, 1] },
    },
    required: ['to', 'value', 'operation'],
  };
