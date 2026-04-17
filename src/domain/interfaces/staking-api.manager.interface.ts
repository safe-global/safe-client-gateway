// SPDX-License-Identifier: FSL-1.1-MIT
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IStakingApi } from '@/domain/interfaces/staking-api.interface';

export const IStakingApiManager = Symbol('IStakingApiManager');

export interface IStakingApiManager extends IApiManager<IStakingApi> {}
