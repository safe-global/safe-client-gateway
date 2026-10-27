// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hex, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { getAllMultiSendDeployments } from '#/domain/common/utils/deployments';
import type { ILoggingService } from '#/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  applyConfigurationEncoder,
  requestConfigurationEncoder,
} from '#/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { safePolicyGuardConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/safe-policy-guard-configuration.builder';
import { policyIndexerConfigurationRootBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/configuration-root.builder';
import { policyIndexerGuardEnforcedPolicyBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/guard-enforced-policy.builder';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardEnforcedPolicy,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafePolicyGuardConfiguration } from '#/modules/policies/domain/entities/safe-policy-guard-configuration.entity';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import { GUARD_POLICY_TYPES } from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { DelayedGuardPoliciesMapper } from '#/modules/policies/routes/mappers/delayed-guard-policies.mapper';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

const mockLoggingService = {
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA_CHAIN_ID = '11155111';

// Policy contracts of the policy-engine deployment CGW recognises.
const COSIGNER_POLICY = getAddress(
  '0x65Bc0DADF4173C6d7125300cad9360339B3Ee478',
);
const ERC20_TRANSFER_POLICY = getAddress(
  '0x25DDa3b8974a10E93ca188F9C149A42F938Bd187',
);
const MULTISEND_POLICY = getAddress(
  '0xF933Ec646F9cd6Dd27Ae2f808D133D3f5847210c',
);

function randomSepoliaMultiSendAddress(): Address {
  return faker.helpers.arrayElement(
    getAllMultiSendDeployments({ chainId: SEPOLIA_CHAIN_ID }),
  );
}

describe('DelayedGuardPoliciesMapper', () => {
  let target: DelayedGuardPoliciesMapper;
  const safe = {
    chainId: SEPOLIA_CHAIN_ID,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const [guard] = getSafePolicyGuardDeployments(SEPOLIA_CHAIN_ID);
  const expiry = faker.number.int({ min: 3_600, max: 86_400 });
  const now = Math.floor(faker.date.recent().getTime() / 1000);

  beforeEach(() => {
    target = new DelayedGuardPoliciesMapper(
      new MultiSendDecoder(mockLoggingService),
      new SafePolicyGuardDecoder(),
      mockLoggingService,
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
    guard?: Address;
  }): PolicyIndexerConfigurationRoot {
    const readyAt = args.readyAt ?? now + 60;
    return policyIndexerConfigurationRootBuilder()
      .with('chainId', safe.chainId)
      .with('safe', safe.address)
      .with('guard', args.guard ?? guard)
      .with('root', configurationRoot(args.configurations))
      .with('status', args.status ?? 'PENDING')
      .with('readyAt', readyAt)
      .with('expiresAt', readyAt + expiry)
      .build();
  }

  function stored(
    configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>],
  ): SafePolicyGuardConfiguration {
    return safePolicyGuardConfigurationBuilder()
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
    operation?: Operation;
  }): MultisigTransaction {
    return multisigTransactionBuilder()
      .with('to', args.to)
      .with('operation', args.operation ?? Operation.CALL)
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
    to: Address = guard,
  ): MultisigTransaction {
    return queued({
      to,
      data: applyConfigurationEncoder()
        .with('configurations', configurations)
        .encode(),
      confirmations,
    });
  }

  /**
   * Maps for a Safe whose transaction guard is {@link guard} unless
   * {@link args.enabledGuard} names another.
   */
  function map(args: {
    enabledGuard?: Address | null;
    onChainConfigurations?: Array<PolicyIndexerConfigurationRoot>;
    storedConfigurations?: Array<SafePolicyGuardConfiguration>;
    transactions?: Array<MultisigTransaction>;
    bindings?: Array<PolicyIndexerGuardEnforcedPolicy>;
    types?: ReadonlyArray<PolicyType>;
  }): ReturnType<DelayedGuardPoliciesMapper['map']> {
    return target.map({
      safe,
      guard: args.enabledGuard === undefined ? guard : args.enabledGuard,
      moduleGuard: null,
      transactions: args.transactions ?? [],
      onChainConfigurations: args.onChainConfigurations ?? [],
      storedConfigurations: args.storedConfigurations ?? [],
      guardEnforcedPolicies: args.bindings ?? [],
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

      expect(map({ storedConfigurations: [draft] })).toStrictEqual([
        {
          kind: 'delayed-guard-policies',
          status: 'draft',
          safe,
          guard: null,
          root: draft.root,
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
        map({ storedConfigurations: [draft], transactions: [transaction] }),
      ).toStrictEqual([
        {
          kind: 'delayed-guard-policies',
          status: 'configuration-in-signing',
          safe,
          guard,
          root: draft.root,
          configurations: draft.configurations,
          readyAt: null,
          expiresAt: null,
          transaction: {
            safeTxHash: transaction.safeTxHash,
            nonce: transaction.nonce,
            confirmations: 1,
            confirmationsRequired: 2,
            proposedAt: unixSeconds(transaction.submissionDate),
            proposer: transaction.proposer,
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

      expect(map({ onChainConfigurations: [root] })).toStrictEqual([
        {
          kind: 'delayed-guard-policies',
          status: 'pending-application',
          safe,
          guard,
          root: root.root,
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

      const [item] = map({ onChainConfigurations: [root] });

      expect(item.status).toBe('pending-application');
    });

    it('should report a queued apply as being signed', () => {
      const config = configurations();
      const transaction = apply(config, 1);

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - 60 }),
        ],
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
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - 60 }),
        ],
        transactions: [apply(config, 2)],
      });

      expect(item.status).toBe('application-ready');
    });

    it('should keep a fully signed apply pending until its delay has passed', () => {
      // The guard reverts an apply before `readyAt`, however signed.
      const config = configurations();
      const transaction = apply(config, 2);

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now + 60 }),
        ],
        transactions: [transaction],
      });

      expect(item).toStrictEqual(
        expect.objectContaining({
          status: 'pending-application',
          transaction: expect.objectContaining({
            safeTxHash: transaction.safeTxHash,
          }),
        }),
      );
    });

    it('should report the first queued apply of a root', () => {
      const config = configurations();
      const first = apply(config, 1);

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - 60 }),
        ],
        transactions: [first, apply(config, 2)],
      });

      expect(item).toStrictEqual(
        expect.objectContaining({
          status: 'application-in-signing',
          transaction: expect.objectContaining({
            safeTxHash: first.safeTxHash,
          }),
        }),
      );
    });

    it('should date a root CGW did not store by its queued transaction', () => {
      const config = configurations();
      const transaction = apply(config, 1);

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - 60 }),
        ],
        transactions: [transaction],
      });

      expect(item.createdAt).toBe(unixSeconds(transaction.submissionDate));
    });

    it('should not report a stored root as a draft while an apply is queued', () => {
      const config = configurations();

      expect(
        map({
          storedConfigurations: [stored(config)],
          transactions: [apply(config)],
        }),
      ).toStrictEqual([]);
    });

    it('should skip and log a guard call whose arguments do not decode', () => {
      const valid = applyConfigurationEncoder()
        .with('configurations', configurations())
        .encode();
      // The selector matches, the arguments are cut short.
      const truncated: Hex = `0x${valid.slice(2, 74)}`;
      const transaction = queued({
        to: guard,
        data: truncated,
        confirmations: 1,
      });

      expect(map({ transactions: [transaction] })).toStrictEqual([]);
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Could not decode a queued SafePolicyGuard configuration call',
          chainId: safe.chainId,
          safeTxHash: transaction.safeTxHash,
        }),
      );
    });

    it('should report a fully signed apply as ready from readyAt itself', () => {
      const config = configurations();

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now }),
        ],
        transactions: [apply(config, 2)],
      });

      expect(item.status).toBe('application-ready');
    });

    it('should report an apply signed beyond its threshold as ready', () => {
      const config = configurations();

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - 60 }),
        ],
        transactions: [apply(config, 3)],
      });

      expect(item.status).toBe('application-ready');
    });

    it('should report a pending root with a queued request as pending application', () => {
      const config = configurations();

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - 60 }),
        ],
        transactions: [request(config)],
      });

      expect(item).toStrictEqual(
        expect.objectContaining({
          status: 'pending-application',
          transaction: null,
        }),
      );
    });

    it('should report the apply of a pending root queued after a request', () => {
      const config = configurations();
      const queuedApply = apply(config, 1);

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - 60 }),
        ],
        transactions: [request(config), queuedApply],
      });

      expect(item).toStrictEqual(
        expect.objectContaining({
          status: 'application-in-signing',
          transaction: expect.objectContaining({
            safeTxHash: queuedApply.safeTxHash,
          }),
        }),
      );
    });

    it('should report the first of two queued requests of a root', () => {
      const config = configurations();
      const first = request(config, 1);

      const [item] = map({
        storedConfigurations: [stored(config)],
        transactions: [first, request(config, 2)],
      });

      expect(item).toStrictEqual(
        expect.objectContaining({
          status: 'configuration-in-signing',
          transaction: expect.objectContaining({
            safeTxHash: first.safeTxHash,
          }),
        }),
      );
    });

    it('should take expiresAt from the root', () => {
      const root = {
        ...onChain({ configurations: configurations(), readyAt: now - 60 }),
        expiresAt: now + faker.number.int({ min: 1, max: 86_400 }),
      };

      expect(map({ onChainConfigurations: [root] })).toStrictEqual([
        expect.objectContaining({
          status: 'pending-application',
          readyAt: root.readyAt,
          expiresAt: root.expiresAt,
        }),
      ]);
    });

    it('should report a root past its application window as expired', () => {
      const root = onChain({
        configurations: configurations(),
        readyAt: now - expiry,
      });

      expect(map({ onChainConfigurations: [root] })).toStrictEqual([
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
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - expiry }),
        ],
        transactions: [request(config)],
      });

      expect(item.status).toBe('configuration-in-signing');
    });

    it('should report an expired root as expired even when an apply is queued', () => {
      // The apply would revert with RootConfigurationExpired.
      const config = configurations();

      const [item] = map({
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - expiry }),
        ],
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
            onChainConfigurations: [
              onChain({ configurations: config, status }),
            ],
            storedConfigurations: [stored(config)],
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
        onChainConfigurations: [
          onChain({ configurations: config, readyAt: now - 60 }),
        ],
        transactions: [
          queued({
            to: randomSepoliaMultiSendAddress(),
            operation: Operation.DELEGATE,
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

  describe('the same root on two guards', () => {
    // The root hashes only the configurations, so requesting the same
    // configurations on two guards gives both the same root.
    const previousGuard = getAddress(faker.finance.ethereumAddress());

    it("should report the window of the Safe's current guard, not the root read last", () => {
      const config = configurations();
      const transaction = apply(config, 2);
      const current = onChain({ configurations: config, readyAt: now - 60 });
      // The previous guard has a longer delay, so the indexer returns its row
      // last.
      const previous = onChain({
        configurations: config,
        readyAt: now + 3_600,
        guard: previousGuard,
      });

      expect(
        map({
          onChainConfigurations: [current, previous],
          transactions: [transaction],
        }),
      ).toStrictEqual([
        expect.objectContaining({
          status: 'application-ready',
          guard,
          readyAt: current.readyAt,
          expiresAt: current.expiresAt,
          transaction: expect.objectContaining({
            safeTxHash: transaction.safeTxHash,
          }),
        }),
      ]);
    });

    it('should not report a pending root on a guard the Safe no longer uses', () => {
      const config = configurations();

      expect(
        map({
          onChainConfigurations: [
            onChain({
              configurations: config,
              readyAt: now - 60,
              guard: previousGuard,
            }),
          ],
        }),
      ).toStrictEqual([]);
    });

    it("should report a root on the current guard when the previous guard's row is invalidated", () => {
      const config = configurations();
      const current = onChain({ configurations: config, readyAt: now - 60 });

      expect(
        map({
          onChainConfigurations: [
            current,
            onChain({
              configurations: config,
              readyAt: now + 3_600,
              status: 'INVALIDATED',
              guard: previousGuard,
            }),
          ],
        }),
      ).toStrictEqual([
        expect.objectContaining({
          status: 'pending-application',
          guard,
          readyAt: current.readyAt,
        }),
      ]);
    });

    it('should not match an apply queued on another guard to the open window', () => {
      const config = configurations();
      const current = onChain({ configurations: config, readyAt: now - 60 });

      expect(
        map({
          onChainConfigurations: [
            current,
            onChain({
              configurations: config,
              readyAt: now - 60,
              guard: previousGuard,
            }),
          ],
          transactions: [apply(config, 2, previousGuard)],
        }),
      ).toStrictEqual([
        expect.objectContaining({
          status: 'pending-application',
          guard,
          transaction: null,
        }),
      ]);
    });

    it('should not match an apply queued on another known guard that has no row for the root', () => {
      const [, otherDeployment] =
        getSafePolicyGuardDeployments(SEPOLIA_CHAIN_ID);
      const config = configurations();

      expect(
        map({
          onChainConfigurations: [
            onChain({ configurations: config, readyAt: now - 60 }),
          ],
          transactions: [apply(config, 2, otherDeployment)],
        }),
      ).toStrictEqual([
        expect.objectContaining({
          status: 'pending-application',
          guard,
          transaction: null,
        }),
      ]);
    });

    it('should attach the stored configurations to the change on the current guard', () => {
      const config = configurations();
      const configuration = stored(config);

      expect(
        map({
          onChainConfigurations: [
            onChain({ configurations: config, readyAt: now - 60 }),
          ],
          storedConfigurations: [configuration],
        }),
      ).toStrictEqual([
        expect.objectContaining({
          status: 'pending-application',
          guard,
          configurations: config,
          createdAt: unixSeconds(configuration.createdAt),
        }),
      ]);
    });

    it('should report stored configurations as a draft when only a guard the Safe no longer uses has their root', () => {
      const config = configurations();

      expect(
        map({
          onChainConfigurations: [
            onChain({
              configurations: config,
              readyAt: now - 60,
              guard: previousGuard,
            }),
          ],
          storedConfigurations: [stored(config)],
        }),
      ).toStrictEqual([
        expect.objectContaining({ status: 'draft', guard: null }),
      ]);
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
        storedConfigurations: [cosigner, erc20Transfer],
        types: [PolicyType.Cosigner],
      });

      expect(items.map((item) => item.root)).toStrictEqual([cosigner.root]);
    });

    it('should keep a root of mixed types if any of them is requested', () => {
      const mixed = stored([
        ...configurationOf(COSIGNER_POLICY),
        ...configurationOf(MULTISEND_POLICY),
      ]);

      expect(
        map({ storedConfigurations: [mixed], types: [PolicyType.MultiSend] }),
      ).toHaveLength(1);
      expect(
        map({ storedConfigurations: [mixed], types: [PolicyType.Allow] }),
      ).toStrictEqual([]);
    });

    it('should type a removal by the binding it removes', () => {
      const binding = policyIndexerGuardEnforcedPolicyBuilder()
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
          storedConfigurations: [removal],
          bindings: [binding],
          types: [PolicyType.Cosigner],
        }),
      ).toHaveLength(1);
      expect(
        map({
          storedConfigurations: [removal],
          bindings: [binding],
          types: [PolicyType.Erc20Transfer],
        }),
      ).toStrictEqual([]);
    });

    it('should type a removal by the binding on its own guard, not on another guard', () => {
      const onGuard = policyIndexerGuardEnforcedPolicyBuilder()
        .with('chainId', safe.chainId)
        .with('safe', safe.address)
        .with('guard', guard)
        .with('kind', 'COSIGNER')
        .build();
      const onOtherGuard = policyIndexerGuardEnforcedPolicyBuilder()
        .with('chainId', safe.chainId)
        .with('safe', safe.address)
        .with('target', onGuard.target)
        .with('selector', onGuard.selector)
        .with('kind', 'ERC20_TRANSFER')
        .build();
      const config = [
        policyConfigurationBuilder()
          .with('target', onGuard.target)
          .with('selector', onGuard.selector)
          .with('operation', 0)
          .with('policy', zeroAddress)
          .build(),
      ];

      expect(
        map({
          onChainConfigurations: [onChain({ configurations: config })],
          storedConfigurations: [stored([config[0]])],
          bindings: [onOtherGuard, onGuard],
          types: [PolicyType.Cosigner],
        }),
      ).toStrictEqual([
        expect.objectContaining({ guard, status: 'pending-application' }),
      ]);
    });

    it('should type a removal by the binding of its exact access', () => {
      const binding = policyIndexerGuardEnforcedPolicyBuilder()
        .with('chainId', safe.chainId)
        .with('safe', safe.address)
        .with('kind', 'COSIGNER')
        .build();
      // Same target and selector, bound for DELEGATECALL instead.
      const delegateBinding = policyIndexerGuardEnforcedPolicyBuilder()
        .with('chainId', safe.chainId)
        .with('safe', safe.address)
        .with('target', binding.target)
        .with('selector', binding.selector)
        .with('operation', 'DELEGATECALL')
        .with('kind', 'ERC20_TRANSFER')
        .build();
      const removal = stored([
        policyConfigurationBuilder()
          .with('target', binding.target)
          .with('selector', binding.selector)
          .with('operation', Operation.DELEGATE)
          .with('policy', zeroAddress)
          .build(),
      ]);

      expect(
        map({
          storedConfigurations: [removal],
          bindings: [binding, delegateBinding],
          types: [PolicyType.Erc20Transfer],
        }),
      ).toHaveLength(1);
      expect(
        map({
          storedConfigurations: [removal],
          bindings: [binding, delegateBinding],
          types: [PolicyType.Cosigner],
        }),
      ).toStrictEqual([]);
    });

    it('should keep a configuration of an unknown policy contract', () => {
      const unknown = stored(
        configurationOf(getAddress(faker.finance.ethereumAddress())),
      );

      expect(
        map({ storedConfigurations: [unknown], types: [PolicyType.Deny] }),
      ).toHaveLength(1);
    });

    it('should keep a root whose configurations are unknown', () => {
      const root = onChain({ configurations: configurations() });

      expect(
        map({ onChainConfigurations: [root], types: [PolicyType.Deny] }),
      ).toHaveLength(1);
    });
  });
});
