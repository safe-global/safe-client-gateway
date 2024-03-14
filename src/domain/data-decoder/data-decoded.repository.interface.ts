import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';

export const IDataDecodedRepository = Symbol('IDataDecodedRepository');

export interface IDataDecodedRepository {
  /**
   * Gets the {@link DataDecoded} associated with {@link chainId} the for the {@link data}
   * and the address pointed by {@link to}.
   */
  getDataDecoded(args: {
    chainId: string;
    data: `0x${string}`;
    to?: `0x${string}`;
  }): Promise<DataDecoded>;
}
