// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import type { CosignerPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import { CosignerPolicyResolver } from '@/modules/policies/domain/resolvers/cosigner-policy.resolver';
import { policyId } from '@/modules/policies/domain/utils/policy-access.utils';

const mockPolicyTokenService = {
  getTokenInfo: vi.fn(),
} as MockedObject<PolicyTokenService>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

function cosignerData(cosigner: string): PolicyConfirmation['dataDecoded'] {
  return { policyName: 'CoSignerPolicy', parameters: { cosigner } };
}

describe('CosignerPolicyResolver', () => {
  let resolver: CosignerPolicyResolver;
  const chainId = faker.string.numeric({ length: 3 });

  beforeEach(() => {
    vi.resetAllMocks();
    resolver = new CosignerPolicyResolver(
      mockPolicyTokenService,
      mockLoggingService,
    );
    mockPolicyTokenService.getTokenInfo.mockImplementation(
      async ({ address }) => ({
        address,
        symbol: 'TKN',
        decimals: 6,
        logoUri: null,
      }),
    );
  });

  it('should build one rule per confirmation', async () => {
    const cosigner = getAddress(faker.finance.ethereumAddress());
    const confirmation = policyConfirmationBuilder()
      .with('dataDecoded', cosignerData(cosigner))
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map(),
    });

    expect(result).toStrictEqual([
      {
        id: policyId([confirmation]),
        type: PolicyType.Cosigner,
        data: {
          rules: [
            {
              token: {
                address: confirmation.target,
                symbol: 'TKN',
                decimals: 6,
                logoUri: null,
              },
              cosigner: { address: cosigner },
              thresholdAmount: null,
            },
          ],
        },
        sources: [confirmation],
      },
    ]);
  });

  it('should resolve the cosigner name from the space address book', async () => {
    const cosigner = getAddress(faker.finance.ethereumAddress());
    const confirmation = policyConfirmationBuilder()
      .with('dataDecoded', cosignerData(cosigner))
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map([[cosigner.toLowerCase(), 'Compliance']]),
    });

    const { rules } = result[0].data as CosignerPolicyData;
    expect(rules[0].cosigner).toStrictEqual({
      address: cosigner,
      name: 'Compliance',
    });
  });

  it('should report no threshold, as the event carries none', async () => {
    const confirmation = policyConfirmationBuilder()
      .with(
        'dataDecoded',
        cosignerData(getAddress(faker.finance.ethereumAddress())),
      )
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map(),
    });

    const { rules } = result[0].data as CosignerPolicyData;
    expect(rules[0].thresholdAmount).toBeNull();
  });

  it('should keep one rule per token', async () => {
    const confirmations = [
      policyConfirmationBuilder()
        .with(
          'dataDecoded',
          cosignerData(getAddress(faker.finance.ethereumAddress())),
        )
        .build(),
      policyConfirmationBuilder()
        .with(
          'dataDecoded',
          cosignerData(getAddress(faker.finance.ethereumAddress())),
        )
        .build(),
    ];

    const result = await resolver.resolve({
      chainId,
      confirmations,
      names: new Map(),
    });

    expect(result).toHaveLength(2);
  });

  it.each([
    ['missing', null],
    [
      'malformed',
      { policyName: 'CoSignerPolicy', parameters: { cosigner: 'nope' } },
    ],
    [
      'of another policy',
      { policyName: 'ERC20TransferPolicy', parameters: { recipients: [] } },
    ],
  ])('should drop a rule with %s dataDecoded and log it', async (_, dataDecoded) => {
    const confirmation = policyConfirmationBuilder()
      .with('dataDecoded', dataDecoded as PolicyConfirmation['dataDecoded'])
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map(),
    });

    expect(result).toStrictEqual([]);
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Could not read CoSignerPolicy cosigner',
      }),
    );
  });

  it('should keep the valid rules when one is undecodable', async () => {
    const valid = policyConfirmationBuilder()
      .with(
        'dataDecoded',
        cosignerData(getAddress(faker.finance.ethereumAddress())),
      )
      .build();
    const invalid = policyConfirmationBuilder()
      .with('dataDecoded', null)
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [valid, invalid],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].sources).toStrictEqual([valid]);
  });
});
