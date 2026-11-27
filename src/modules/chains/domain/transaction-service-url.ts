// SPDX-License-Identifier: FSL-1.1-MIT
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';

export function getTransactionServiceUrl(
  chain: Chain,
  useVpcUrl: boolean,
): string {
  if (!useVpcUrl) {
    return chain.transactionService;
  }
  if (!chain.vpcTransactionService) {
    throw new Error(
      `Chain ${chain.chainId} has no vpcTransactionService. Read chains from the Config Service internal API, or disable USE_TX_SERVICE_VPC_URL.`,
    );
  }
  return chain.vpcTransactionService;
}
