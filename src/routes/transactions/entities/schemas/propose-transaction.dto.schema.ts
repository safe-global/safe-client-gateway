import { JSONSchemaType } from 'ajv';
import { ProposeTransactionDto } from '../propose-transaction.dto.entity';

export const proposeTransactionDtoSchema: JSONSchemaType<ProposeTransactionDto> =
  {
    $id: 'https://safe-client.safe.global/schemas/transactions/propose-transaction.dto.json',
    type: 'object',
    properties: {
      to: { type: 'string' },
      value: { type: 'string' },
      data: {
        oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
        default: null,
      },
      nonce: { type: 'string' },
      operation: { type: 'number', enum: [0, 1] },
      safeTxGas: { type: 'string' },
      baseGas: { type: 'string' },
      gasPrice: { type: 'string' },
      gasToken: { type: 'string' },
      refundReceiver: {
        oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
        default: null,
      },
      safeTxHash: { type: 'string' },
      sender: { type: 'string' },
      signature: {
        oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
        default: null,
      },
      origin: {
        oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
        default: null,
      },
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
