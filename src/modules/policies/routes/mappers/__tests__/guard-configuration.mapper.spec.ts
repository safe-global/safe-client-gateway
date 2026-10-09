// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hex, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  applyConfigurationEncoder,
  requestConfigurationEncoder,
} from '@/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import { SafePolicyGuardDecoder } from '@/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { storedPolicyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/stored-policy-configuration.builder';
import { policyIndexerConfigurationRootBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/configuration-root.builder';
import { policyIndexerSafePolicyBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-policy.builder';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerSafePolicy,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { StoredPolicyConfiguration } from '@/modules/policies/domain/entities/stored-policy-configuration.entity';
import { getSafePolicyGuardDeployments } from '@/modules/policies/domain/policy-deployments.constants';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';
import { GuardConfigurationMapper } from '@/modules/policies/routes/mappers/guard-configuration.mapper';
import { GUARD_POLICY_TYPES } from '@/modules/policies/routes/mappers/guard-policy.mapper';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA_CHAIN_ID = '11155111';
// Policy contracts of the policy-engine deployment CGW recognises.
const COSIGNER_POLICY = getAddress(
  '0xC49f4786aF99b7c3Edf0A3F71E6B969B76302ca5',
);
const ERC20_TRANSFER_POLICY = getAddress(
  '0x37AB4Fd7eFaDfC6cc35e09196f74c19F163EdA43',
);

describe('GuardConfigurationMapper', () => {
  let target: GuardConfigurationMapper;
  const safe = {
    chainId: SEPOLIA_CHAIN_ID,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const [guard] = getSafePolicyGuardDeployments(SEPOLIA_CHAIN_ID);
  const expiry = faker.number.int({ min: 3_600, max: 86_400 });
  const now = Math.floor(faker.date.recent().getTime() / 1000);

  beforeEach(() => {
    target = new GuardConfigurationMapper(
      new MultiSendDecoder(mockLoggingService),
      new SafePolicyGuardDecoder(),
    );
  });

  function configurations(): [PolicyConfiguration] {
    return [policyConfigurationBuilder().build()];
  }

  /** A root of the Safe on the guard, pending and in its delay by default. */
  function onChain(args: {
    configurations: Array<PolicyConfiguration>;
    status?: PolicyIndexerConfigurationRoot['status'];
    readyAt?: number;
  }): PolicyIndexerConfigurationRoot {
    return policyIndexerConfigurationRootBuilder()
      .with('chainId', safe.chainId)
      .with('safe', safe.address)
      .with('guard', guard)
      .with('root', configurationRoot(args.configurations))
      .with('status', args.status ?? 'PENDING')
      .with('readyAt', args.readyAt ?? now + 60)
      .build();
  }

  function stored(
    configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>],
  ): StoredPolicyConfiguration {
    return storedPolicyConfigurationBuilder()
      .with('chainId', safe.chainId)
      .with('safeAddress', safe.address)
      .with('root', configurationRoot(configurations))
      .with('configurations', configurations)
      .build();
  }

  /** A queued transaction with `confirmations` of 2 signatures. */
  function queued(args: {
    to: Address;
    data: Hex;
    confirmations: number;
  }): MultisigTransaction {
    return multisigTransactionBuilder()
      .with('to', args.to)
      .with('operation', Operation.CALL)
      .with('data', args.data)
      .with('confirmationsRequired', 2)
      .with(
        'confirmations',
        Array.from({ length: args.confirmations }, () =>
          confirmationBuilder().build(),
        ),
      )
      .build();
  }

  function request(
    configurations: Array<PolicyConfiguration>,
    confirmations = 1,
  ): MultisigTransaction {
    return queued({
      to: guard,
      data: requestConfigurationEncoder()
        .with('configureRoot', configurationRoot(configurations))
        .encode(),
      confirmations,
    });
  }

  function apply(
    configurations: Array<PolicyConfiguration>,
    confirmations = 1,
  ): MultisigTransaction {
    return queued({
      to: guard,
      data: applyConfigurationEncoder()
        .with('configurations', configurations)
        .encode(),
      confirmations,
    });
  }

  function map(args: {
    roots?: Array<PolicyIndexerConfigurationRoot>;
    stored?: Array<StoredPolicyConfiguration>;
    transactions?: Array<MultisigTransaction>;
    bindings?: Array<PolicyIndexerSafePolicy>;
    types?: ReadonlyArray<PolicyType>;
  }): ReturnType<GuardConfigurationMapper['map']> {
    return target.map({
      safe,
      transactions: args.transactions ?? [],
      roots: args.roots ?? [],
      stored: args.stored ?? [],
      bindings: args.bindings ?? [],
      expiries: new Map([[guard, expiry]]),
      types: args.types ?? GUARD_POLICY_TYPES,
      now,
    });
  }

  function unixSeconds(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  describe('status', () => {
    it('should report stored configurations nothing has requested as a draft', () => {
      const draft = stored(configurations());

      expect(map({ stored: [draft] })).toStrictEqual([
        {
          kind: 'guard-configuration',
          status: 'draft',
          safe,
          guard: null,
          configureRoot: draft.root,
          configurations: draft.configurations,
          readyAt: null,
          expiresAt: null,
          transaction: null,
          createdAt: unixSeconds(draft.createdAt),
        },
      ]);
    });

    it('should report a queued request as being signed', () => {
      const config = configurations();
      const draft = stored(config);
      const transaction = request(config, 1);

      expect(
        map({ stored: [draft], transactions: [transaction] }),
      ).toStrictEqual([
        {
          kind: 'guard-configuration',
          status: 'configuration-in-signing',
          safe,
          guard,
          configureRoot: draft.root,
          configurations: draft.configurations,
          readyAt: null,
          expiresAt: null,
          transaction: {
            safeTxHash: transaction.safeTxHash,
            nonce: transaction.nonce,
            confirmations: 1,
            confirmationsRequired: 2,
            proposedAt: unixSeconds(transaction.submissionDate),
          },
          createdAt: unixSeconds(draft.createdAt),
        },
      ]);
    });

    it('should report a root still in its delay as pending application', () => {
      const root = onChain({
        configurations: configurations(),
        readyAt: now + 3_600,
      });

      expect(map({ roots: [root] })).toStrictEqual([
        {
          kind: 'guard-configuration',
          status: 'pending-application',
          safe,
          guard,
          configureRoot: root.root,
          configurations: null,
          readyAt: root.readyAt,
          expiresAt: root.readyAt + expiry,
          transaction: null,
          createdAt: null,
        },
      ]);
    });

    it('should report a root past its delay and not expired as pending application', () => {
      const root = onChain({
        configurations: configurations(),
        readyAt: now - 60,
      });

      const [item] = map({ roots: [root] });

      expect(item.status).toBe('pending-application');
    });

    it('should report a queued apply as being signed', () => {
      const config = configurations();
      const transaction = apply(config, 1);

      const [item] = map({
        roots: [onChain({ configurations: config, readyAt: now - 60 })],
        transactions: [transaction],
      });

      expect(item).toStrictEqual(
        expect.objectContaining({
          status: 'application-in-signing',
          configurations: config,
          transaction: expect.objectContaining({
            safeTxHash: transaction.safeTxHash,
            confirmations: 1,
          }),
        }),
      );
    });

    it('should report a fully signed apply as ready', () => {
      const config = configurations();

      const [item] = map({
        roots: [onChain({ configurations: config, readyAt: now - 60 })],
        transactions: [apply(config, 2)],
      });

      expect(item.status).toBe('application-ready');
    });

    it('should report a root past its application window as expired', () => {
      const root = onChain({
        configurations: configurations(),
        readyAt: now - expiry,
      });

      expect(map({ roots: [root] })).toStrictEqual([
        expect.objectContaining({
          status: 'expired',
          readyAt: root.readyAt,
          expiresAt: root.readyAt + expiry,
          transaction: null,
        }),
      ]);
    });

    it('should report requesting an expired root again as being signed', () => {
      const config = configurations();

      const [item] = map({
        roots: [onChain({ configurations: config, readyAt: now - expiry })],
        transactions: [request(config)],
      });

      expect(item.status).toBe('configuration-in-signing');
    });

    it('should report an expired root as expired even when an apply is queued', () => {
      // The apply would revert with RootConfigurationExpired.
      const config = configurations();

      const [item] = map({
        roots: [onChain({ configurations: config, readyAt: now - expiry })],
        transactions: [apply(config)],
      });

      expect(item).toStrictEqual(
        expect.objectContaining({ status: 'expired', transaction: null }),
      );
    });

    it.each(['APPLIED' as const, 'INVALIDATED' as const])(
      'should not report a %s root, even when its configurations are stored',
      (status) => {
        const config = configurations();

        expect(
          map({
            roots: [onChain({ configurations: config, status })],
            stored: [stored(config)],
          }),
        ).toStrictEqual([]);
      },
    );

    it('should find an apply inside a MultiSend batch', () => {
      const config = configurations();
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              operation: Operation.CALL,
              to: guard,
              value: BigInt(0),
              data: applyConfigurationEncoder()
                .with('configurations', config)
                .encode(),
            },
          ]),
        )
        .encode();

      const [item] = map({
        roots: [onChain({ configurations: config, readyAt: now - 60 })],
        transactions: [
          queued({
            to: getAddress(faker.finance.ethereumAddress()),
            data,
            confirmations: 1,
          }),
        ],
      });

      expect(item.status).toBe('application-in-signing');
    });

    it('should ignore a request to an unknown contract', () => {
      const config = configurations();

      expect(
        map({
          transactions: [
            queued({
              to: getAddress(faker.finance.ethereumAddress()),
              data: requestConfigurationEncoder()
                .with('configureRoot', configurationRoot(config))
                .encode(),
              confirmations: 1,
            }),
          ],
        }),
      ).toStrictEqual([]);
    });
  });

  describe('types', () => {
    function configurationOf(policy: Address): [PolicyConfiguration] {
      return [policyConfigurationBuilder().with('policy', policy).build()];
    }

    it('should report only the configurations that set a requested type', () => {
      const cosigner = stored(configurationOf(COSIGNER_POLICY));
      const erc20Transfer = stored(configurationOf(ERC20_TRANSFER_POLICY));

      const items = map({
        stored: [cosigner, erc20Transfer],
        types: [PolicyType.Cosigner],
      });

      expect(items.map((item) => item.configureRoot)).toStrictEqual([
        cosigner.root,
      ]);
    });

    it('should type a removal by the binding it removes', () => {
      const binding = policyIndexerSafePolicyBuilder()
        .with('chainId', safe.chainId)
        .with('safe', safe.address)
        .with('kind', 'COSIGNER')
        .build();
      const removal = stored([
        policyConfigurationBuilder()
          .with('target', binding.target)
          .with('selector', binding.selector)
          .with('operation', 0)
          .with('policy', zeroAddress)
          .build(),
      ]);

      expect(
        map({
          stored: [removal],
          bindings: [binding],
          types: [PolicyType.Cosigner],
        }),
      ).toHaveLength(1);
      expect(
        map({
          stored: [removal],
          bindings: [binding],
          types: [PolicyType.Erc20Transfer],
        }),
      ).toStrictEqual([]);
    });

    it('should keep a configuration of an unknown policy contract', () => {
      const unknown = stored(
        configurationOf(getAddress(faker.finance.ethereumAddress())),
      );

      expect(map({ stored: [unknown], types: [PolicyType.Deny] })).toHaveLength(
        1,
      );
    });

    it('should keep a root whose configurations are unknown', () => {
      const root = onChain({ configurations: configurations() });

      expect(map({ roots: [root], types: [PolicyType.Deny] })).toHaveLength(1);
    });
  });
});
