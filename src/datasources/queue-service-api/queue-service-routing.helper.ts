// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class QueueServiceRoutingHelper {
  private readonly isQueueServiceEnabled: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isQueueServiceEnabled = this.configurationService.getOrThrow<boolean>(
      'features.queueService',
    );
  }

  /**
   * Returns true if queue service routing is enabled.
   * When true, queue operations (propose, confirm, delete, messages, delegates)
   * should be routed to the queue service instead of the TX service.
   */
  get isEnabled(): boolean {
    return this.isQueueServiceEnabled;
  }

  /**
   * Executes one of two callbacks based on the feature flag.
   * @param args.whenEnabled - Called when queue service is enabled
   * @param args.whenDisabled - Called when queue service is disabled
   */
  async route<T>(args: {
    whenEnabled: () => Promise<T>;
    whenDisabled: () => Promise<T>;
  }): Promise<T> {
    if (this.isQueueServiceEnabled) {
      return args.whenEnabled();
    }
    return args.whenDisabled();
  }
}
