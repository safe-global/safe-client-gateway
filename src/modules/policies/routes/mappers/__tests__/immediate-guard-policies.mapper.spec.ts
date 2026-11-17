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
import { setGuardEncoder } from '#/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  configureImmediatelyEncoder,
  requestConfigurationEncoder,
} from '#/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { policyIndexerGuardEnforcedPolicyBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/guard-enforced-policy.builder';
import type { PolicyIndexerGuardEnforcedPolicy } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import { GUARD_POLICY_TYPES } from '#/modules/policies/domain/utils/policy.utils';
import { ImmediateGuardPoliciesMapper } from '#/modules/policies/routes/mappers/immediate-guard-policies.mapper';
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

describe('ImmediateGuardPoliciesMapper', () => {
  let target: ImmediateGuardPoliciesMapper;
  const safe = {
    chainId: SEPOLIA_CHAIN_ID,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const [guard] = getSafePolicyGuardDeployments(SEPOLIA_CHAIN_ID);

  beforeEach(() => {
    vi.resetAllMocks();
    target = new ImmediateGuardPoliciesMapper(
      new MultiSendDecoder(mockLoggingService),
      new SafePolicyGuardDecoder(),
      mockLoggingService,
    );
  });

  /** A queued transaction with `confirmations` of 2 signatures. */
  function queued(args: {
    to: Address;
    data: Hex;
    confirmations?: number;
    operation?: Operation;
  }): MultisigTransaction {
    return multisigTransactionBuilder()
      .with('to', args.to)
      .with('operation', args.operation ?? Operation.CALL)
      .with('data', args.data)
      .with('confirmationsRequired', 2)
      .with(
        'confirmations',
        Array.from({ length: args.confirmations ?? 1 }, () =>
          confirmationBuilder().build(),
        ),
      )
      .build();
  }

  function map(args: {
    transactions: Array<MultisigTransaction>;
    guardEnforcedPolicies?: Array<PolicyIndexerGuardEnforcedPolicy>;
    types?: ReadonlyArray<PolicyType>;
  }): ReturnType<ImmediateGuardPoliciesMapper['map']> {
    return target.map({
      safe,
      transactions: args.transactions,
      guardEnforcedPolicies: args.guardEnforcedPolicies ?? [],
      types: args.types ?? GUARD_POLICY_TYPES,
    });
  }

  /** A queued `configureImmediately` on {@link guard} of {@link configurations}. */
  function configuringImmediately(
    configurations: Array<PolicyConfiguration>,
  ): MultisigTransaction {
    return queued({
      to: guard,
      data: configureImmediatelyEncoder()
        .with('configurations', configurations)
        .encode(),
    });
  }

  it('should report a configureImmediately on a known guard while it is being signed', () => {
    const configureImmediately = configureImmediatelyEncoder();
    const transaction = queued({
      to: guard,
      data: configureImmediately.encode(),
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([
      {
        kind: 'immediate-guard-policies',
        status: 'in-signing',
        safe,
        guard,
        configurations: configureImmediately.build().configurations,
        transaction: {
          safeTxHash: transaction.safeTxHash,
          nonce: transaction.nonce,
          confirmations: 1,
          confirmationsRequired: 2,
          proposedAt: Math.floor(transaction.submissionDate.getTime() / 1000),
          proposer: transaction.proposer,
        },
      },
    ]);
  });

  it('should report a fully signed configureImmediately as ready', () => {
    const transaction = queued({
      to: guard,
      data: configureImmediatelyEncoder().encode(),
      confirmations: 2,
    });

    const [item] = map({ transactions: [transaction] });

    expect(item.status).toBe('ready');
  });

  it('should find a configureImmediately inside a MultiSend batch', () => {
    const configureImmediately = configureImmediatelyEncoder();
    const batch = multiSendEncoder()
      .with(
        'transactions',
        multiSendTransactionsEncoder([
          {
            operation: Operation.CALL,
            to: guard,
            value: BigInt(0),
            data: configureImmediately.encode(),
          },
          {
            operation: Operation.CALL,
            to: safe.address,
            value: BigInt(0),
            data: setGuardEncoder().with('guard', guard).encode(),
          },
        ]),
      )
      .encode();
    const transaction = queued({
      to: faker.helpers.arrayElement(
        getAllMultiSendDeployments({ chainId: SEPOLIA_CHAIN_ID }),
      ),
      operation: Operation.DELEGATE,
      data: batch,
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([
      expect.objectContaining({
        kind: 'immediate-guard-policies',
        guard,
        configurations: configureImmediately.build().configurations,
      }),
    ]);
  });

  it('should ignore configureImmediately on an unknown contract', () => {
    const transaction = queued({
      to: getAddress(faker.finance.ethereumAddress()),
      data: configureImmediatelyEncoder().encode(),
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
  });

  it('should ignore other calls to the guard', () => {
    const transaction = queued({
      to: guard,
      data: requestConfigurationEncoder().encode(),
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
  });

  it('should skip and log a configureImmediately whose arguments do not decode', () => {
    const valid = configureImmediatelyEncoder().encode();
    // The selector matches, the arguments are cut short.
    const truncated: Hex = `0x${valid.slice(2, 74)}`;
    const transaction = queued({ to: guard, data: truncated });

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Could not decode a queued configureImmediately call',
        chainId: safe.chainId,
        safeTxHash: transaction.safeTxHash,
      }),
    );
  });

  describe('types', () => {
    function configurationOf(policy: Address): PolicyConfiguration {
      return policyConfigurationBuilder().with('policy', policy).build();
    }

    it('should report only the calls that set a requested type', () => {
      const cosigner = configuringImmediately([
        configurationOf(COSIGNER_POLICY),
      ]);
      const erc20Transfer = configuringImmediately([
        configurationOf(ERC20_TRANSFER_POLICY),
      ]);

      const items = map({
        transactions: [cosigner, erc20Transfer],
        types: [PolicyType.Cosigner],
      });

      expect(items.map((item) => item.transaction.safeTxHash)).toStrictEqual([
        cosigner.safeTxHash,
      ]);
    });

    it('should keep a call of mixed types if any of them is requested', () => {
      const mixed = configuringImmediately([
        configurationOf(COSIGNER_POLICY),
        configurationOf(ERC20_TRANSFER_POLICY),
      ]);

      expect(
        map({ transactions: [mixed], types: [PolicyType.Erc20Transfer] }),
      ).toHaveLength(1);
      expect(
        map({ transactions: [mixed], types: [PolicyType.Allow] }),
      ).toStrictEqual([]);
    });

    it('should type a removal by the guard enforced policy it removes', () => {
      const guardEnforcedPolicy = policyIndexerGuardEnforcedPolicyBuilder()
        .with('chainId', safe.chainId)
        .with('safe', safe.address)
        .with('operation', 'CALL')
        .with('kind', 'COSIGNER')
        .build();
      const removal = configuringImmediately([
        policyConfigurationBuilder()
          .with('target', guardEnforcedPolicy.target)
          .with('selector', guardEnforcedPolicy.selector)
          .with('operation', Operation.CALL)
          .with('policy', zeroAddress)
          .build(),
      ]);

      expect(
        map({
          transactions: [removal],
          guardEnforcedPolicies: [guardEnforcedPolicy],
          types: [PolicyType.Cosigner],
        }),
      ).toHaveLength(1);
      expect(
        map({
          transactions: [removal],
          guardEnforcedPolicies: [guardEnforcedPolicy],
          types: [PolicyType.Erc20Transfer],
        }),
      ).toStrictEqual([]);
    });

    it('should keep a removal of no known guard enforced policy', () => {
      const removal = configuringImmediately([configurationOf(zeroAddress)]);

      expect(
        map({ transactions: [removal], types: [PolicyType.Deny] }),
      ).toHaveLength(1);
    });

    it('should keep a configuration of an unknown policy contract', () => {
      const unknown = configuringImmediately([
        configurationOf(getAddress(faker.finance.ethereumAddress())),
      ]);

      expect(
        map({ transactions: [unknown], types: [PolicyType.Deny] }),
      ).toHaveLength(1);
    });
  });
});
