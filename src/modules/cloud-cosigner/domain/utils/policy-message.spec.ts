// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { cloudCosignerPolicyBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-policy.builder';
import { buildPolicyMessage } from '@/modules/cloud-cosigner/domain/utils/policy-message';

describe('buildPolicyMessage', () => {
  it('should render every policy field on its own line', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const issuedAt = faker.date.recent().toISOString();
    const policy = cloudCosignerPolicyBuilder()
      .with('valueThresholdUsd', 100_000)
      .with('reviewUnknownContracts', true)
      .with('instructions', 'Never approve unlimited allowances.')
      .build();

    expect(buildPolicyMessage({ chainId, safeAddress, issuedAt, policy })).toBe(
      [
        'Safe cloud cosigner policy update',
        `Chain ID: ${chainId}`,
        `Safe: ${safeAddress}`,
        `Issued at: ${issuedAt}`,
        'Value threshold (USD): 100000',
        'Review unknown contracts: true',
        'Instructions:',
        'Never approve unlimited allowances.',
      ].join('\n'),
    );
  });

  it('should render missing instructions as an empty last line', () => {
    const message = buildPolicyMessage({
      chainId: faker.string.numeric(),
      safeAddress: getAddress(faker.finance.ethereumAddress()),
      issuedAt: faker.date.recent().toISOString(),
      policy: cloudCosignerPolicyBuilder().with('instructions', null).build(),
    });

    expect(message.endsWith('Instructions:\n')).toBe(true);
  });
});
