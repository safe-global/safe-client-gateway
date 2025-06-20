import type { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { Transaction } from '@/domain/safe/entities/transaction.entity';

export const IDataDecoderRepository = Symbol('IDataDecoderRepository');

export interface IDataDecoderRepository {
  getDecodedData(args: {
    chainId: string;
    data: `0x${string}`;
    to: `0x${string}`;
  }): Promise<DataDecoded>;

  getTransactionDataDecoded(args: {
    chainId: string;
    transaction: Transaction;
  }): Promise<DataDecoded | null>;
}
