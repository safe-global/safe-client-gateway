import type { DataDecoded } from '@/modules/data-decoder/routes/entities/data-decoded.entity';
import type { Address, Hex } from 'viem';

export type TransactionData = {
  data: Hex | null;
  operation: number;
  to: Address;
  value: bigint | string;
};

export type DecodedTransactionData = TransactionData & {
  dataDecoded: DataDecoded | null;
};

export type DecodedMultiSendTransactionData = DecodedTransactionData & {
  dataDecoded: DataDecoded & {
    method: 'multiSend';
    parameters: Array<{
      name: 'transactions';
      type: 'bytes';
      value: Hex;
      valueDecoded: Array<DecodedTransactionData>;
    }>;
  };
};

export type DecodedExecTransactionData = DecodedTransactionData & {
  dataDecoded: DataDecoded & {
    method: 'execTransaction';
    parameters: [
      {
        name: 'to';
        type: 'address';
        value: Address;
        valueDecoded: null;
      },
      {
        name: 'value';
        type: 'uint256';
        value: string;
        valueDecoded: null;
      },
      {
        name: 'data';
        type: 'bytes';
        value: Hex;
        valueDecoded: null;
      },
      {
        name: 'operation';
        type: 'uint256';
        value: string;
        valueDecoded: null;
      },
    ];
  };
};
