// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { KilnApiManager } from '@/modules/staking/datasources/kiln-api.manager';

@Injectable()
export class StakingApiManager extends KilnApiManager {
  protected readonly widget = 'staking';
}
