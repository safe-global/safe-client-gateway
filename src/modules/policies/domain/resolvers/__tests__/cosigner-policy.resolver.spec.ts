// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { policyGroupBuilder } from '@/modules/policies/domain/entities/__tests__/policy-group.builder';
import type { CosignerPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import { CosignerPolicyResolver } from '@/modules/policies/domain/resolvers/cosigner-policy.resolver';

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

/** One `configure` call on `token`, setting `cosigner`. */
function configureCall(args: {
  token: `0x${string}`;
  cosigner: string;
  blockNumber?: number;
}): PolicyConfirmation {
  return policyConfirmationBuilder()
    .with('target', args.token)
    .with('blockNumber', args.blockNumber ?? 1)
    .with('dataDecoded', cosignerData(args.cosigner))
    .build();
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

  it('should build one rule per group', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const cosigner = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([configureCall({ token, cosigner })]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    expect(result).toStrictEqual([
      {
        id: group.access,
        type: PolicyType.Cosigner,
        data: {
          rules: [
            {
              token: {
                address: token,
                symbol: 'TKN',
                decimals: 6,
                logoUri: null,
              },
              cosigner: { address: cosigner },
              thresholdAmount: null,
            },
          ],
        },
        groups: [group],
      },
    ]);
  });

  it('should read the newest configure call, which replaces the rule', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const replaced = getAddress(faker.finance.ethereumAddress());
    const current = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([
      configureCall({ token, cosigner: replaced, blockNumber: 1 }),
      configureCall({ token, cosigner: current, blockNumber: 2 }),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    const { rules } = result[0].data as CosignerPolicyData;
    expect(rules[0].cosigner).toStrictEqual({ address: current });
  });

  it('should resolve the cosigner name from the space address book', async () => {
    const cosigner = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([
      configureCall({
        token: getAddress(faker.finance.ethereumAddress()),
        cosigner,
      }),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map([[cosigner.toLowerCase(), 'Compliance']]),
    });

    const { rules } = result[0].data as CosignerPolicyData;
    expect(rules[0].cosigner).toStrictEqual({
      address: cosigner,
      name: 'Compliance',
    });
  });

  it('should report no threshold, as the event carries none', async () => {
    const group = policyGroupBuilder([
      configureCall({
        token: getAddress(faker.finance.ethereumAddress()),
        cosigner: getAddress(faker.finance.ethereumAddress()),
      }),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    const { rules } = result[0].data as CosignerPolicyData;
    expect(rules[0].thresholdAmount).toBeNull();
  });

  it('should keep one rule per token', async () => {
    const groups = [
      policyGroupBuilder([
        configureCall({
          token: getAddress(faker.finance.ethereumAddress()),
          cosigner: getAddress(faker.finance.ethereumAddress()),
        }),
      ]),
      policyGroupBuilder([
        configureCall({
          token: getAddress(faker.finance.ethereumAddress()),
          cosigner: getAddress(faker.finance.ethereumAddress()),
        }),
      ]),
    ];

    await expect(
      resolver.resolve({ chainId, groups, names: new Map() }),
    ).resolves.toHaveLength(2);
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
    const group = policyGroupBuilder([
      policyConfirmationBuilder()
        .with('dataDecoded', dataDecoded as PolicyConfirmation['dataDecoded'])
        .build(),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
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
    const valid = policyGroupBuilder([
      configureCall({
        token: getAddress(faker.finance.ethereumAddress()),
        cosigner: getAddress(faker.finance.ethereumAddress()),
      }),
    ]);
    const invalid = policyGroupBuilder([
      policyConfirmationBuilder().with('dataDecoded', null).build(),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [valid, invalid],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].groups).toStrictEqual([valid]);
  });

  it('should return an empty list without groups', async () => {
    await expect(
      resolver.resolve({ chainId, groups: [], names: new Map() }),
    ).resolves.toStrictEqual([]);
  });
});
