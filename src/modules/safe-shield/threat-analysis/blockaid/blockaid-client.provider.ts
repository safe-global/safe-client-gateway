// SPDX-License-Identifier: FSL-1.1-MIT
import Blockaid from '@blockaid/client';
import type { Provider } from '@nestjs/common';

export const BlockaidClient = Symbol('BlockaidClient');

// The SDK reads its API key from BLOCKAID_CLIENT_API_KEY.
export const blockaidClientProvider: Provider = {
  provide: BlockaidClient,
  useFactory: (): Blockaid => new Blockaid(),
};
