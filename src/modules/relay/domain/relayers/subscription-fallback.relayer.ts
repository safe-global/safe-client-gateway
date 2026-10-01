// SPDX-License-Identifier: FSL-1.1-MIT
import type { Relay } from '@/modules/relay/domain/entities/relay.entity';
import { RelayLimitReachedError } from '@/modules/relay/domain/errors/relay-limit-reached.error';
import type { RelaySubmitter } from '@/modules/relay/domain/interfaces/relayer.interface';

/** Relays on the free quota, and on the subscription once that quota is spent. */
export class SubscriptionFallbackRelayer implements RelaySubmitter {
  public constructor(
    private readonly free: RelaySubmitter,
    private readonly subscription: RelaySubmitter,
  ) {}

  public async relay(
    args: Parameters<RelaySubmitter['relay']>[0],
  ): Promise<Relay> {
    try {
      return await this.free.relay(args);
    } catch (error) {
      // Thrown before submitting, so nothing was relayed on the free quota.
      if (!(error instanceof RelayLimitReachedError)) {
        throw error;
      }
      return await this.subscription.relay(args);
    }
  }
}
