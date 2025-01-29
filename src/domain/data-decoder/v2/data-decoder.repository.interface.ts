import type { Contract } from '@/domain/data-decoder/v2/entities/contract.entity';
import type { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { Page } from '@/domain/entities/page.entity';

export const IDataDecoderRepository = Symbol('IDataDecoderRepository');

export interface IDataDecoderRepository {
  getDecodedData(args: {
    chainId: string;
    data: `0x${string}`;
    to: `0x${string}`;
  }): Promise<DataDecoded>;

  getContracts(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<Page<Contract>>;
}
