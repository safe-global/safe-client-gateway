import { JSONSchemaType } from 'ajv';
import { ProposeTransactionDto } from '../propose-transaction.dto.entity';

export const PROPOSE_TRANSACTION_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/transactions/propose-transaction.dto.json';

export const proposeTransactionDtoSchema: JSONSchemaType<ProposeTransactionDto> =
  {
    $id: PROPOSE_TRANSACTION_DTO_SCHEMA_ID,
    type: 'object',
    properties: {
      to: { type: 'string' },
      value: { type: 'string' },
      data: { oneOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
      nonce: { type: 'string' },
      operation: { type: 'number', enum: [0, 1] },
      safeTxGas: { type: 'string' },
      baseGas: { type: 'string' },
      gasPrice: { type: 'string' },
      gasToken: { type: 'string' },
      refundReceiver: {
        oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      },
      safeTxHash: { type: 'string' },
      sender: { type: 'string' },
      signature: {
        oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      },
      origin: { oneOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
    },
    required: [
      'to',
      'value',
      'nonce',
      'operation',
      'safeTxGas',
      'baseGas',
      'gasPrice',
      'gasToken',
      'safeTxHash',
      'sender',
    ],
  };
