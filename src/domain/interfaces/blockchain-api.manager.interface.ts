import type { PublicClient } from 'viem';
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';

export const IBlockchainApiManager = Symbol('IBlockchainApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IBlockchainApiManager extends IApiManager<PublicClient> {}
