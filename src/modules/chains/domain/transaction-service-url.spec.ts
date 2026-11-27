// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { getTransactionServiceUrl } from '#/modules/chains/domain/transaction-service-url';

describe('getTransactionServiceUrl', () => {
  it('returns the public Transaction Service URL when VPC URLs are off', () => {
    const chain = chainBuilder().build();

    expect(getTransactionServiceUrl(chain, false)).toBe(
      chain.transactionService,
    );
  });

  it('returns the public Transaction Service URL when VPC URLs are off and the chain has no VPC URL', () => {
    const chain = chainBuilder()
      .with('vpcTransactionService', undefined)
      .build();

    expect(getTransactionServiceUrl(chain, false)).toBe(
      chain.transactionService,
    );
  });

  it('returns the VPC Transaction Service URL when VPC URLs are on', () => {
    const vpcTransactionService = faker.internet.url({ appendSlash: false });
    const chain = chainBuilder()
      .with('vpcTransactionService', vpcTransactionService)
      .build();

    expect(getTransactionServiceUrl(chain, true)).toBe(vpcTransactionService);
  });

  it('throws when VPC URLs are on and the chain has no VPC URL', () => {
    const chain = chainBuilder()
      .with('vpcTransactionService', undefined)
      .build();

    expect(() => getTransactionServiceUrl(chain, true)).toThrow(
      `Chain ${chain.chainId} has no vpcTransactionService. Read chains from the Config Service internal API, or disable USE_TX_SERVICE_VPC_URL.`,
    );
  });
});
