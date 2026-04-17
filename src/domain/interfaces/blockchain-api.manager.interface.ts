import type { PublicClient } from 'viem';
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';

export const IBlockchainApiManager = Symbol('IBlockchainApiManager');

export interface IBlockchainApiManager extends IApiManager<PublicClient> {}
