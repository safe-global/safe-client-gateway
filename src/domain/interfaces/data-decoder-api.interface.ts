import type { Contract } from '@/domain/data-decoder/v2/entities/contract.entity';
import type { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IDataDecoderApi = Symbol('IDataDecoderApi');

export interface IDataDecoderApi {
  getDecodedData(args: {
    data: `0x${string}`;
    to: `0x${string}`;
  }): Promise<Raw<DataDecoded>>;

  getContracts(args: {
    address: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Contract>>>;
}
