// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import type { Erc20TransferPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import { Erc20TransferPolicyResolver } from '@/modules/policies/domain/resolvers/erc20-transfer-policy.resolver';
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

function recipientsData(
  recipients: Array<{ recipient: string; allowed: boolean }>,
): PolicyConfirmation['dataDecoded'] {
  return {
    policyName: 'ERC20TransferPolicy',
    parameters: { recipients },
  };
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
    const recipient = getAddress(faker.finance.ethereumAddress());
    const confirmation = policyConfirmationBuilder()
      .with('dataDecoded', recipientsData([{ recipient, allowed: true }]))
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map(),
    });

    expect(result).toStrictEqual([
      {
        id: policyId([confirmation]),
        type: PolicyType.Erc20Transfer,
        data: {
          allowlist: [
            {
              token: {
                address: confirmation.target,
                symbol: 'TKN',
                decimals: 18,
                logoUri: null,
              },
              recipients: [{ address: recipient }],
            },
          ],
        },
        sources: [confirmation],
      },
    ]);
  });

  it('should merge confirmations of the same token', async () => {
    const target = getAddress(faker.finance.ethereumAddress());
    const first = getAddress(faker.finance.ethereumAddress());
    const second = getAddress(faker.finance.ethereumAddress());
    const transfer = policyConfirmationBuilder()
      .with('target', target)
      .with('selector', '0xa9059cbb')
      .with(
        'dataDecoded',
        recipientsData([{ recipient: first, allowed: true }]),
      )
      .build();
    const transferFrom = policyConfirmationBuilder()
      .with('target', target)
      .with('selector', '0x23b872dd')
      .with(
        'dataDecoded',
        recipientsData([{ recipient: second, allowed: true }]),
      )
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [transfer, transferFrom],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist).toHaveLength(1);
    expect(allowlist[0].recipients.map((entry) => entry.address)).toStrictEqual(
      [first, second],
    );
    expect(result[0].id).toBe(policyId([transfer, transferFrom]));
  });

  it('should keep tokens apart', async () => {
    const first = policyConfirmationBuilder()
      .with(
        'dataDecoded',
        recipientsData([
          {
            recipient: getAddress(faker.finance.ethereumAddress()),
            allowed: true,
          },
        ]),
      )
      .build();
    const second = policyConfirmationBuilder()
      .with(
        'dataDecoded',
        recipientsData([
          {
            recipient: getAddress(faker.finance.ethereumAddress()),
            allowed: true,
          },
        ]),
      )
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [first, second],
      names: new Map(),
    });

    expect(result).toHaveLength(2);
  });

  it('should exclude recipients that are not allowed', async () => {
    const allowed = getAddress(faker.finance.ethereumAddress());
    const denied = getAddress(faker.finance.ethereumAddress());
    const confirmation = policyConfirmationBuilder()
      .with(
        'dataDecoded',
        recipientsData([
          { recipient: allowed, allowed: true },
          { recipient: denied, allowed: false },
        ]),
      )
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map(),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].recipients).toStrictEqual([{ address: allowed }]);
  });

  it('should let a later confirmation revoke a recipient', async () => {
    const target = getAddress(faker.finance.ethereumAddress());
    const recipient = getAddress(faker.finance.ethereumAddress());
    const granted = policyConfirmationBuilder()
      .with('target', target)
      .with('selector', '0xa9059cbb')
      .with('dataDecoded', recipientsData([{ recipient, allowed: true }]))
      .build();
    const revoked = policyConfirmationBuilder()
      .with('target', target)
      .with('selector', '0x23b872dd')
      .with('dataDecoded', recipientsData([{ recipient, allowed: false }]))
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [granted, revoked],
      names: new Map(),
    });

    expect(result).toStrictEqual([]);
  });

  it('should de-duplicate a recipient allowed by several accesses', async () => {
    const target = getAddress(faker.finance.ethereumAddress());
    const recipient = getAddress(faker.finance.ethereumAddress());
    const first = policyConfirmationBuilder()
      .with('target', target)
      .with('selector', '0xa9059cbb')
      .with('dataDecoded', recipientsData([{ recipient, allowed: true }]))
      .build();
    const second = policyConfirmationBuilder()
      .with('target', target)
      .with('selector', '0x23b872dd')
      .with('dataDecoded', recipientsData([{ recipient, allowed: true }]))
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [first, second],
      names: new Map(),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].recipients).toHaveLength(1);
  });

  it('should report recipients as address-only, ignoring the address book', async () => {
    // Recipients carry no name: the wallet resolves display names itself, so an
    // address book entry must not add a field to the payload.
    const recipient = getAddress(faker.finance.ethereumAddress());
    const confirmation = policyConfirmationBuilder()
      .with('dataDecoded', recipientsData([{ recipient, allowed: true }]))
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map([[recipient.toLowerCase(), 'Payroll']]),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].recipients).toStrictEqual([{ address: recipient }]);
  });

  it('should keep the policy when token metadata is unavailable', async () => {
    const recipient = getAddress(faker.finance.ethereumAddress());
    const confirmation = policyConfirmationBuilder()
      .with('dataDecoded', recipientsData([{ recipient, allowed: true }]))
      .build();
    mockPolicyTokenService.getTokenInfo.mockResolvedValue({
      address: confirmation.target,
      symbol: null,
      decimals: null,
      logoUri: null,
    });

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map(),
    });

    const { allowlist } = result[0].data as Erc20TransferPolicyData;
    expect(allowlist[0].token).toStrictEqual({
      address: confirmation.target,
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
  ])('should skip a policy with %s dataDecoded and log it', async (_, dataDecoded) => {
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
        message: 'Could not read ERC20TransferPolicy recipients',
      }),
    );
  });

  it('should return an empty list without confirmations', async () => {
    await expect(
      resolver.resolve({ chainId, confirmations: [], names: new Map() }),
    ).resolves.toStrictEqual([]);
  });
});
