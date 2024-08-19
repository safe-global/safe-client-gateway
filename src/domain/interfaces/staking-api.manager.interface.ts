import { IApiManager } from '@/domain/interfaces/api.manager.interface';
import { IStakingApi } from '@/domain/interfaces/staking-api.interface';

export const IStakingApiManager = Symbol('IStakingApiManager');

export interface IStakingApiManager extends IApiManager<IStakingApi> {}
