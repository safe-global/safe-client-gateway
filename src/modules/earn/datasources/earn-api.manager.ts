// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { KilnApiManager } from '@/modules/staking/datasources/kiln-api.manager';

// Note: each widget deployment is its own Kiln "organization", so earn
// deployments have different base URLs when compared to the staking API.

@Injectable()
export class EarnApiManager extends KilnApiManager {
  protected readonly widget = 'earn';
}
