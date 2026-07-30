// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  policyConfirmationBuilder,
  TRANSFER_SELECTOR,
} from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { policyGroupBuilder } from '@/modules/policies/domain/entities/__tests__/policy-group.builder';
import type { Erc20TransferPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import { Erc20TransferPolicyResolver } from '@/modules/policies/domain/resolvers/erc20-transfer-policy.resolver';
import {
  accessSelector,
  policyId,
} from '@/modules/policies/domain/utils/policy-access.utils';

const mockPolicyTokenService = {
  getTokenInfo: vi.fn(),
} as MockedObject<PolicyTokenService>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

function recipientsData(
  recipients: Array<{ recipient: string; allowed: boolean }>,
): PolicyConfirmation['dataDecoded'] {
  return {
    policyName: 'ERC20TransferPolicy',
    parameters: { recipients },
  };
}

/**
 * One `configure` call on `token`, allowing or revoking `recipients`.
 */
function configureCall(args: {
  token: `0x${string}`;
  recipients: Array<{ recipient: string; allowed: boolean }>;
  selector?: `0x${string}`;
  blockNumber?: number;
}): PolicyConfirmation {
  return policyConfirmationBuilder()
    .with('target', args.token)
    .with('selector', args.selector ?? TRANSFER_SELECTOR)
    .with('blockNumber', args.blockNumber ?? 1)
    .with('dataDecoded', recipientsData(args.recipients))
    .build();
}

describe('Erc20TransferPolicyResolver', () => {
  let resolver: Erc20TransferPolicyResolver;
  const chainId = faker.string.numeric({ length: 3 });

  beforeEach(() => {
    vi.resetAllMocks();
    resolver = new Erc20TransferPolicyResolver(
      mockPolicyTokenService,
      mockLoggingService,
    );
    mockPolicyTokenService.getTokenInfo.mockImplementation(
      async ({ address }) => ({
        address,
        symbol: 'TKN',
        decimals: 18,
        logoUri: null,
      }),
    );
  });

  it('should build one allowlist entry per token', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const recipient = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([
      configureCall({ token, recipients: [{ recipient, allowed: true }] }),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    expect(result).toStrictEqual([
      {
        id: group.access,
        type: PolicyType.Erc20Transfer,
        data: {
          allowlist: [
            {
              token: {
                address: token,
                symbol: 'TKN',
                decimals: 18,
                logoUri: null,
              },
              recipients: [{ address: recipient }],
            },
          ],
        },
        groups: [group],
      },
    ]);
  });

  it('should accumulate the recipients configured over several transactions', async () => {
    // The reported case: the policy contract upserts recipients, so three
    // configure calls on one access each allowing one recipient add up to a
    // three-recipient allowlist.
    const token = getAddress(faker.finance.ethereumAddress());
    const recipients = [
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
    ];
    const group = policyGroupBuilder([
      configureCall({
        token,
        blockNumber: 465,
        recipients: [{ recipient: recipients[0], allowed: true }],
      }),
      configureCall({
        token,
        blockNumber: 469,
        recipients: [{ recipient: recipients[1], allowed: true }],
      }),
      configureCall({
        token,
        blockNumber: 473,
        recipients: [{ recipient: recipients[2], allowed: true }],
      }),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].recipients.map((entry) => entry.address)).toStrictEqual(
      recipients,
    );
    // one access, however many configure calls it received
    expect(result[0].id).toBe(group.access);
  });

  it('should let a later configure call revoke a recipient', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const kept = getAddress(faker.finance.ethereumAddress());
    const revoked = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([
      configureCall({
        token,
        blockNumber: 1,
        recipients: [
          { recipient: kept, allowed: true },
          { recipient: revoked, allowed: true },
        ],
      }),
      configureCall({
        token,
        blockNumber: 2,
        recipients: [{ recipient: revoked, allowed: false }],
      }),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].recipients).toStrictEqual([{ address: kept }]);
  });

  it('should drop a token whose recipients were all revoked', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const recipient = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([
      configureCall({
        token,
        blockNumber: 1,
        recipients: [{ recipient, allowed: true }],
      }),
      configureCall({
        token,
        blockNumber: 2,
        recipients: [{ recipient, allowed: false }],
      }),
    ]);

    await expect(
      resolver.resolve({ chainId, groups: [group], names: new Map() }),
    ).resolves.toStrictEqual([]);
  });

  it('should fold the accesses of one token into a single entry', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const first = getAddress(faker.finance.ethereumAddress());
    const second = getAddress(faker.finance.ethereumAddress());
    const transfer = policyGroupBuilder([
      configureCall({
        token,
        selector: TRANSFER_SELECTOR,
        recipients: [{ recipient: first, allowed: true }],
      }),
    ]);
    const transferFrom = policyGroupBuilder([
      configureCall({
        token,
        selector: '0x23b872dd',
        recipients: [{ recipient: second, allowed: true }],
      }),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [transfer, transferFrom],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist).toHaveLength(1);
    expect(allowlist[0].recipients.map((entry) => entry.address)).toStrictEqual(
      [first, second],
    );
    expect(result[0].id).toBe(policyId([transfer.access, transferFrom.access]));
    expect(result[0].groups).toStrictEqual([transfer, transferFrom]);
  });

  it('should keep tokens apart', async () => {
    const groups = [
      policyGroupBuilder([
        configureCall({
          token: getAddress(faker.finance.ethereumAddress()),
          recipients: [
            {
              recipient: getAddress(faker.finance.ethereumAddress()),
              allowed: true,
            },
          ],
        }),
      ]),
      policyGroupBuilder([
        configureCall({
          token: getAddress(faker.finance.ethereumAddress()),
          recipients: [
            {
              recipient: getAddress(faker.finance.ethereumAddress()),
              allowed: true,
            },
          ],
        }),
      ]),
    ];

    await expect(
      resolver.resolve({ chainId, groups, names: new Map() }),
    ).resolves.toHaveLength(2);
  });

  it('should de-duplicate a recipient allowed by several accesses', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const recipient = getAddress(faker.finance.ethereumAddress());
    const groups = [
      policyGroupBuilder([
        configureCall({
          token,
          selector: TRANSFER_SELECTOR,
          recipients: [{ recipient, allowed: true }],
        }),
      ]),
      policyGroupBuilder([
        configureCall({
          token,
          selector: '0x23b872dd',
          recipients: [{ recipient, allowed: true }],
        }),
      ]),
    ];

    const result = await resolver.resolve({
      chainId,
      groups,
      names: new Map(),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].recipients).toHaveLength(1);
  });

  it('should fold recipients case insensitively and report them checksummed', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const recipient = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([
      configureCall({
        token,
        blockNumber: 1,
        recipients: [{ recipient: recipient.toLowerCase(), allowed: true }],
      }),
      configureCall({
        token,
        blockNumber: 2,
        recipients: [{ recipient, allowed: true }],
      }),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].recipients).toStrictEqual([{ address: recipient }]);
  });

  it('should keep the policy when token metadata is unavailable', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([
      configureCall({
        token,
        recipients: [
          {
            recipient: getAddress(faker.finance.ethereumAddress()),
            allowed: true,
          },
        ],
      }),
    ]);
    mockPolicyTokenService.getTokenInfo.mockResolvedValue({
      address: token,
      symbol: null,
      decimals: null,
      logoUri: null,
    });

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].token).toStrictEqual({
      address: token,
      symbol: null,
      decimals: null,
      logoUri: null,
    });
  });

  it.each([
    ['missing', null],
    [
      'malformed',
      { policyName: 'ERC20TransferPolicy', parameters: { recipients: 'nope' } },
    ],
    [
      'of another policy',
      { policyName: 'CoSignerPolicy', parameters: { cosigner: '0x1' } },
    ],
  ])('should skip an event with %s dataDecoded and log it', async (_, dataDecoded) => {
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
        message: 'Could not read ERC20TransferPolicy recipients',
      }),
    );
  });

  it('should keep the recipients of the readable events when one is undecodable', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const recipient = getAddress(faker.finance.ethereumAddress());
    const group = policyGroupBuilder([
      configureCall({
        token,
        blockNumber: 1,
        recipients: [{ recipient, allowed: true }],
      }),
      policyConfirmationBuilder()
        .with('target', token)
        .with('blockNumber', 2)
        .with('dataDecoded', null)
        .build(),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].recipients).toStrictEqual([{ address: recipient }]);
  });

  it('should identify an item by the access word of its only group', async () => {
    const token = getAddress(faker.finance.ethereumAddress());
    const confirmation = configureCall({
      token,
      recipients: [
        {
          recipient: getAddress(faker.finance.ethereumAddress()),
          allowed: true,
        },
      ],
    });

    const result = await resolver.resolve({
      chainId,
      groups: [policyGroupBuilder([confirmation])],
      names: new Map(),
    });

    expect(result[0].id).toBe(accessSelector(confirmation));
  });

  it('should return an empty list without groups', async () => {
    await expect(
      resolver.resolve({ chainId, groups: [], names: new Map() }),
    ).resolves.toStrictEqual([]);
  });
});
