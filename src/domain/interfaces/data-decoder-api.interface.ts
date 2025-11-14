import type { Contract } from '@/modules/data-decoder/domain/v2/entities/contract.entity';
import type { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address } from 'viem';

export const IDataDecoderApi = Symbol('IDataDecoderApi');

export interface IDataDecoderApi {
  getDecodedData(args: {
    data: Address;
    to: Address;
  }): Promise<Raw<DataDecoded>>;

  getContracts(args: {
    address: Address;
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Contract>>>;

  getTrustedForDelegateCallContracts(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Contract>>>;
}
