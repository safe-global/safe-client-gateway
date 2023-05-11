import { JSONSchemaType } from 'ajv';
import { ProposeTransactionDto } from '../propose-transaction.dto.entity';

export const proposeTransactionDtoSchema: JSONSchemaType<ProposeTransactionDto> =
  {
    $id: 'https://safe-client.safe.global/schemas/transactions/propose-transaction.dto.json',
    type: 'object',
    properties: {
      to: { type: 'string' },
      value: { type: 'string' },
      data: { type: 'string', nullable: true },
      nonce: { type: 'string' },
      operation: { type: 'number', enum: [0, 1] },
      safeTxGas: { type: 'string' },
      baseGas: { type: 'string' },
      gasPrice: { type: 'string' },
      gasToken: { type: 'string', nullable: true },
      refundReceiver: { type: 'string', nullable: true },
      safeTxHash: { type: 'string' },
      sender: { type: 'string' },
      signature: { type: 'string', nullable: true },
      origin: { type: 'string', nullable: true },
    },
    required: [
      'to',
      'value',
      'nonce',
      'operation',
      'safeTxGas',
      'baseGas',
      'gasPrice',
      'safeTxHash',
      'sender',
    ],
  };
