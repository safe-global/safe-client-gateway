import { Safe } from './entities/safe.entity';

export const ISafeRepository = Symbol('ISafeRepository');

export interface ISafeRepository {
  getSafe(chainId: string, address: string): Promise<Safe>;
}
