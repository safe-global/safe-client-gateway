import type { Address } from 'viem';
import type { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { Transaction } from '@/modules/safe/domain/entities/transaction.entity';

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
