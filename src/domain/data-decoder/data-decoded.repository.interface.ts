import { DataDecoded } from './entities/data-decoded.entity';

export const IDataDecodedRepository = Symbol('IDataDecodedRepository');

export interface IDataDecodedRepository {
  /**
   * Gets the {@link DataDecoded} associated with {@link chainId} the for the {@link data}
   * and the address pointed by {@link to}.
   *
   * @param chainId
   * @param data
   * @param to
   */
  decode(chainId: string, data: string, to: string): Promise<DataDecoded>;
}
