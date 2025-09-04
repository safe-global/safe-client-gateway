import type { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { Transaction } from '@/domain/safe/entities/transaction.entity';
import type { Address } from 'viem';

export const IDataDecoderRepository = Symbol('IDataDecoderRepository');

export interface IDataDecoderRepository {
  getDecodedData(args: {
    chainId: string;
    data: Address;
    to: Address;
  }): Promise<DataDecoded>;

  getTransactionDataDecoded(args: {
    chainId: string;
    transaction: Transaction;
  }): Promise<DataDecoded | null>;
}
