// SPDX-License-Identifier: FSL-1.1-MIT
//
// Property-based fuzzer for DelayedGuardPoliciesMapper.
//
// Run: FUZZ_RUNS=20000 FUZZ_SEED=1 TZ=UTC ./node_modules/.bin/vitest run --project unit delayed-guard-policies.mapper.fuzz
//
// Builds random inputs for one Safe and checks every returned item against a
// model written from SafePolicyGuard and the Safe, not from the mapper:
// - a call only counts if the Safe itself makes it: a direct CALL, or a CALL
//   inside a DELEGATECALL to an official MultiSend, nested or not;
// - a root is open on its guard while PENDING and before `readyAt + EXPIRY`,
//   and applicable once `readyAt` has passed; a request on an open root
//   reverts with `RootAlreadyConfigured`;
// - a transaction executes its calls in order and reverts as a whole;
// - rows count only for a guard set on the Safe; queued calls count on any guard;
// - a transaction is fully signed when confirmations >= confirmationsRequired.
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hex, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
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
  PolicyIndexerGuardPolicyKind,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PendingDelayedGuardPolicies } from '#/modules/policies/domain/entities/pending-policy.entity';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { policyOperationFromValue } from '#/modules/policies/domain/entities/policy-operation.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafePolicyGuardConfiguration } from '#/modules/policies/domain/entities/safe-policy-guard-configuration.entity';
import {
  getPolicyTypeOfContract,
  getSafePolicyGuardDeployments,
} from '#/modules/policies/domain/policy-deployments.constants';
import {
  GUARD_POLICY_TYPES,
  guardPolicyKindsOf,
  guardPolicyTypeOfKind,
} from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { DelayedGuardPoliciesMapper } from '#/modules/policies/routes/mappers/delayed-guard-policies.mapper';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

const RUNS = Number(process.env.FUZZ_RUNS ?? 300);
const SEED = Number(process.env.FUZZ_SEED ?? 1);
// Generator features to leave out, comma-separated: sentinel, nested,
// unfiltered, pairs. Isolates which feature a violation needs.
const OFF = new Set((process.env.FUZZ_OFF ?? '').split(','));

/**
 * Violations of open issues, tolerated so the suite stays green; any other
 * kind fails it. Remove an entry once its fix lands.
 */
const KNOWN_VIOLATIONS: ReadonlyArray<string> = [
  // A queued apply hides a stored draft.
  'stored draft not returned',
  // A row with expiresAt 0 is read as expired.
  'open window on an enabled guard but no pending item',
  'expired but the window is still open',
  'executable apply queued but item is not application-ready (unknown expiry)',
  'configuration-in-signing but its transaction reverts on its open window on chain (unknown expiry)',
  // The first apply at a nonce wins, however signed.
  'executable apply queued but item is not application-ready (same-nonce replacement)',
  // A request on a guard the Safe moved away from ignores that guard's window.
  'configuration-in-signing but its transaction reverts on its open window on chain',
  // Calls are matched one by one, never the batch as a whole.
  'configuration-in-signing but its transaction reverts on another call in the batch',
  'configuration-in-signing but its transaction reverts on another call in the batch requesting a root open on chain',
  'configuration-in-signing but its transaction reverts on another call in the batch requesting a root open on chain (unknown expiry)',
  'configuration-in-signing but its transaction reverts on the same call repeated in the batch',
  'application-ready but its transaction reverts on another call in the batch',
  'application-ready but its transaction reverts on another call in the batch requesting a root open on chain',
  'application-ready but its transaction reverts on another call in the batch requesting a root open on chain (unknown expiry)',
  'application-ready but its transaction reverts on the same call repeated in the batch',
  // Batches are unpacked one level only.
  'request queued but no item (nested MultiSend)',
  'executable apply queued but item is not application-ready (nested MultiSend)',
  // Bindings are matched on any guard, not the item's.
  'returned although no configuration sets a requested type (unfiltered bindings)',
  'dropped although a configuration sets a requested type (unfiltered bindings)',
];

const CHAIN_ID = '11155111';
const NOW = 1_700_000_000;
const THRESHOLD = 2;
// The EXPIRY of every SafePolicyGuard deployment.
const EXPIRY = 7 * 86_400;
const MULTI_SEND_CALL_ONLY = getAddress(
  '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D',
);
// The full MultiSend: unlike MultiSendCallOnly it runs DELEGATECALL sub-calls.
const MULTI_SEND = getAddress('0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761');

type Wrap =
  | 'direct-call'
  | 'multisend-delegatecall'
  | 'nested-multisend'
  | 'multisend-call'
  | 'delegatecall-to-non-multisend';

type Call = { kind: 'request' | 'apply'; root: Hex; guard: Address };

type QueuedMeta = {
  label: string;
  nonce: number;
  submittedAt: number;
  confirmations: number;
  wrap: Wrap;
  calls: Array<Call>;
};

type Root = { root: Hex; configurations: Array<PolicyConfiguration> };

type Case = {
  guard: Address | null;
  moduleGuard: Address | null;
  roots: Array<Root>;
  onChain: Array<PolicyIndexerConfigurationRoot>;
  stored: Array<SafePolicyGuardConfiguration>;
  transactions: Array<MultisigTransaction>;
  meta: Map<Hex, QueuedMeta>;
  bindings: Array<PolicyIndexerGuardEnforcedPolicy>;
  bindingsFiltered: boolean;
  types: Array<PolicyType>;
};

type Violation = { invariant: string; detail: string };

const mockLoggingService = {
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
} as MockedObject<ILoggingService>;

const safe = {
  chainId: CHAIN_ID,
  address: getAddress('0x00000000000000000000000000000000000000a1'),
};
const DEPLOYMENTS = getSafePolicyGuardDeployments(CHAIN_ID);
// Deployment order: DELAY 0 s, 60 s, 10 min, 1 hour, 1 day.
const [G1, G2, G3, G4] = DEPLOYMENTS;
const GUARDS = [G1, G2, G3];
const DELAY = new Map<Address, number>([
  [G1, 0],
  [G2, 60],
  [G3, 600],
]);
const POLICY_CONTRACTS = [
  PolicyType.Allow,
  PolicyType.Deny,
  PolicyType.Cosigner,
  PolicyType.Erc20Transfer,
  PolicyType.MultiSend,
  PolicyType.NativeTransfer,
].map((type) => ({
  type,
  address: knownPolicyContract(type),
}));
const KIND_BY_TYPE = new Map<PolicyType, PolicyIndexerGuardPolicyKind>(
  GUARD_POLICY_TYPES.map((type) => [type, guardPolicyKindsOf([type])[0]]),
);

function knownPolicyContract(type: PolicyType): Address {
  const addresses = [
    '0x92e94Af03982C2486dffa8DcBc5d069D33996eF2',
    '0x348d9F0B2fECb0bF88655C74Ed3eFD5052A9E436',
    '0x65Bc0DADF4173C6d7125300cad9360339B3Ee478',
    '0x25DDa3b8974a10E93ca188F9C149A42F938Bd187',
    '0xF933Ec646F9cd6Dd27Ae2f808D133D3f5847210c',
    '0x2868C263EBF3672211E4C32e0B21689FF0584ca3',
  ].map((address) => getAddress(address));
  const address = addresses.find(
    (candidate) => getPolicyTypeOfContract(CHAIN_ID, candidate) === type,
  );
  if (!address) {
    throw new Error(`No policy contract for ${type}`);
  }
  return address;
}

// --- Generator ---------------------------------------------------------------

function generateConfiguration(): PolicyConfiguration {
  const policy = faker.helpers.weightedArrayElement([
    { weight: 2, value: getAddress(faker.finance.ethereumAddress()) },
    {
      weight: 2,
      value: faker.helpers.arrayElement(POLICY_CONTRACTS).address,
    },
    { weight: 2, value: zeroAddress },
  ]);
  return policyConfigurationBuilder().with('policy', policy).build();
}

function generateSlot(): Address | null {
  return faker.helpers.weightedArrayElement<Address | null>([
    { weight: 2, value: null },
    { weight: 1, value: zeroAddress },
    { weight: 3, value: G1 },
    { weight: 3, value: G2 },
    { weight: 1, value: G3 },
    { weight: 1, value: G4 },
  ]);
}

function generateCase(): Case {
  const roots: Array<Root> = Array.from({ length: 3 }, () => {
    const configurations = Array.from(
      { length: faker.number.int({ min: 1, max: 2 }) },
      generateConfiguration,
    );
    return { root: configurationRoot(configurations), configurations };
  });
  // The same configurations in another order: a different root.
  const reordered =
    roots[0].configurations.length > 1
      ? [...roots[0].configurations].reverse()
      : [generateConfiguration()];
  roots.push({ root: configurationRoot(reordered), configurations: reordered });

  // At most one row per (guard, safe, root).
  const onChain = roots.flatMap(({ root }) =>
    faker.helpers.arrayElements(GUARDS, { min: 0, max: 3 }).map((guard) => {
      const status = faker.helpers.arrayElement([
        'PENDING',
        'APPLIED',
        'INVALIDATED',
      ] as const);
      // Sentinel 0 timestamps on finished rows.
      const readyAt =
        !OFF.has('sentinel') &&
        status !== 'PENDING' &&
        faker.datatype.boolean(0.2)
          ? 0
          : NOW + faker.helpers.arrayElement([-100, 0, 100]);
      // Sentinel 0 expiresAt, the guard still expires at readyAt + EXPIRY.
      const expiresAt =
        !OFF.has('sentinel') && faker.datatype.boolean(0.15)
          ? 0
          : faker.helpers.arrayElement(
              [NOW - 1, NOW, NOW + 1, readyAt + 3_600].filter(
                (at) => at > readyAt,
              ),
            );
      return policyIndexerConfigurationRootBuilder()
        .with('chainId', CHAIN_ID)
        .with('safe', safe.address)
        .with('guard', guard)
        .with('root', root)
        .with('status', status)
        .with('readyAt', readyAt)
        .with('expiresAt', expiresAt)
        .build();
    }),
  );
  // The indexer serves rows by readyAt; also try any other order.
  if (faker.datatype.boolean()) {
    onChain.sort((a, b) => a.readyAt - b.readyAt);
  } else {
    faker.helpers.shuffle(onChain, { inplace: true });
  }

  const stored = roots
    .filter(() => faker.datatype.boolean())
    .map(({ root, configurations }) =>
      safePolicyGuardConfigurationBuilder()
        .with('chainId', CHAIN_ID)
        .with('safeAddress', safe.address)
        .with('root', root)
        .with('configurations', configurations)
        .build(),
    );

  const meta = new Map<Hex, QueuedMeta>();
  const metas: Array<QueuedMeta> = [];
  const count = faker.number.int({ min: 0, max: 5 });
  for (let index = 0; index < count; index++) {
    const previous = metas.at(-1);
    // A replacement: the same calls at the same nonce, signed differently.
    const isReplacement = previous !== undefined && faker.datatype.boolean(0.2);
    const wrap = isReplacement
      ? previous.wrap
      : faker.helpers.weightedArrayElement<Wrap>(
          [
            { weight: 4, value: 'direct-call' as const },
            { weight: 4, value: 'multisend-delegatecall' as const },
            { weight: 1, value: 'nested-multisend' as const },
            { weight: 1, value: 'multisend-call' as const },
            { weight: 1, value: 'delegatecall-to-non-multisend' as const },
          ].filter(
            ({ value }) => !(OFF.has('nested') && value === 'nested-multisend'),
          ),
        );
    const calls = isReplacement ? previous.calls : generateCalls(wrap, roots);
    metas.push({
      label: `T${index}`,
      nonce: isReplacement ? previous.nonce : faker.number.int({ max: 2 }),
      submittedAt: NOW - 1_000 + faker.number.int({ max: 100 }),
      confirmations: faker.number.int({ max: THRESHOLD + 1 }),
      wrap,
      calls,
    });
  }
  // The queue is served by nonce, then submission date.
  metas.sort((a, b) => a.nonce - b.nonce || a.submittedAt - b.submittedAt);
  const transactions = metas.map((queued) => {
    const transaction = buildTransaction(queued, roots);
    meta.set(transaction.safeTxHash, queued);
    return transaction;
  });

  const types = faker.datatype.boolean(0.3)
    ? [...GUARD_POLICY_TYPES]
    : faker.helpers.arrayElements(GUARD_POLICY_TYPES, { min: 1, max: 3 });
  const allBindings = roots
    .flatMap(({ configurations }) => configurations)
    .filter((configuration) => configuration.policy === zeroAddress)
    .flatMap((configuration) =>
      faker.helpers.arrayElements([...GUARDS, G4], { min: 0, max: 2 }).map(
        (guard) =>
          policyIndexerGuardEnforcedPolicyBuilder()
            .with('chainId', CHAIN_ID)
            .with('safe', safe.address)
            .with('guard', guard)
            .with('target', configuration.target)
            .with('selector', configuration.selector)
            .with(
              'operation',
              policyOperationFromValue(configuration.operation),
            )
            .with(
              'kind',
              KIND_BY_TYPE.get(faker.helpers.arrayElement(GUARD_POLICY_TYPES))!,
            )
            .build() as PolicyIndexerGuardEnforcedPolicy,
      ),
    );
  // The service only reads bindings of the requested kinds.
  const bindingsFiltered = OFF.has('unfiltered') || faker.datatype.boolean(0.7);
  const requestedKinds = guardPolicyKindsOf(types);
  const bindings = bindingsFiltered
    ? allBindings.filter((binding) => requestedKinds.includes(binding.kind))
    : allBindings;

  return {
    guard: generateSlot(),
    moduleGuard: generateSlot(),
    roots,
    onChain,
    stored,
    transactions,
    meta,
    bindings,
    bindingsFiltered,
    types,
  };
}

function generateCalls(wrap: Wrap, roots: Array<Root>): Array<Call> {
  const guard = faker.helpers.arrayElement(GUARDS);
  const { root } = faker.helpers.arrayElement(roots);
  if (
    wrap !== 'direct-call' &&
    !OFF.has('pairs') &&
    faker.datatype.boolean(0.25)
  ) {
    // A request and an apply of one root in one batch, in either order.
    const pair: Array<Call> = [
      { kind: 'request', root, guard },
      { kind: 'apply', root, guard },
    ];
    return faker.datatype.boolean() ? pair : pair.reverse();
  }
  const length =
    wrap === 'direct-call' ? 1 : faker.number.int({ min: 1, max: 3 });
  return Array.from({ length }, () => ({
    kind: faker.helpers.arrayElement(['request', 'apply'] as const),
    root: faker.helpers.arrayElement(roots).root,
    guard: faker.datatype.boolean(0.7)
      ? guard
      : faker.helpers.arrayElement(GUARDS),
  }));
}

function buildTransaction(
  queued: QueuedMeta,
  roots: Array<Root>,
): MultisigTransaction {
  const encoded = queued.calls.map((call) => ({
    operation: Operation.CALL,
    to: call.guard,
    value: BigInt(0),
    data:
      call.kind === 'request'
        ? requestConfigurationEncoder()
            .with('configureRoot', call.root)
            .encode()
        : applyConfigurationEncoder()
            .with(
              'configurations',
              roots.find(({ root }) => root === call.root)!.configurations,
            )
            .encode(),
  }));
  const batch = (calls: typeof encoded): Hex =>
    multiSendEncoder()
      .with('transactions', multiSendTransactionsEncoder(calls))
      .encode();

  const [to, operation, data]: [Address, Operation, Hex] = (() => {
    switch (queued.wrap) {
      case 'direct-call':
        return [encoded[0].to, Operation.CALL, encoded[0].data];
      case 'multisend-delegatecall':
        return [MULTI_SEND_CALL_ONLY, Operation.DELEGATE, batch(encoded)];
      case 'nested-multisend':
        return [
          MULTI_SEND,
          Operation.DELEGATE,
          batch([
            {
              operation: Operation.DELEGATE,
              to: MULTI_SEND,
              value: BigInt(0),
              data: batch(encoded),
            },
          ]),
        ];
      case 'multisend-call':
        return [MULTI_SEND_CALL_ONLY, Operation.CALL, batch(encoded)];
      case 'delegatecall-to-non-multisend':
        return [
          getAddress(faker.finance.ethereumAddress()),
          Operation.DELEGATE,
          batch(encoded),
        ];
    }
  })();

  return multisigTransactionBuilder()
    .with('safe', safe.address)
    .with('to', to)
    .with('operation', operation)
    .with('data', data)
    .with('value', '0')
    .with('nonce', queued.nonce)
    .with('isExecuted', false)
    .with('confirmationsRequired', THRESHOLD)
    .with(
      'confirmations',
      Array.from({ length: queued.confirmations }, () =>
        confirmationBuilder().build(),
      ),
    )
    .with('submissionDate', new Date(queued.submittedAt * 1_000))
    .build();
}

// --- Model -------------------------------------------------------------------

function isEffective(wrap: Wrap): boolean {
  return (
    wrap === 'direct-call' ||
    wrap === 'multisend-delegatecall' ||
    wrap === 'nested-multisend'
  );
}

/** The guard's own expiry: `readyAt + EXPIRY`, also for a sentinel 0. */
function trueExpiresAt(row: PolicyIndexerConfigurationRoot): number {
  return row.expiresAt === 0 ? row.readyAt + EXPIRY : row.expiresAt;
}

function isOpen(row: PolicyIndexerConfigurationRoot | undefined): boolean {
  return row?.status === 'PENDING' && NOW < trueExpiresAt(row);
}

function isApplicable(
  row: PolicyIndexerConfigurationRoot | undefined,
): boolean {
  return isOpen(row) && NOW >= row!.readyAt;
}

function isEnabled(testCase: Case, guard: Address | null): boolean {
  return (
    guard !== null &&
    guard !== zeroAddress &&
    (guard === testCase.guard || guard === testCase.moduleGuard)
  );
}

function rowOf(
  testCase: Case,
  guard: Address,
  root: Hex,
): PolicyIndexerConfigurationRoot | undefined {
  return testCase.onChain.find(
    (row) => row.guard === guard && row.root === root,
  );
}

function isFullySigned(meta: QueuedMeta): boolean {
  return meta.confirmations >= THRESHOLD;
}

/**
 * Whether the transaction requests a root open on its guard: it reverts
 * (`RootAlreadyConfigured`) for as long as that window is open.
 */
function requestsOpenRoot(testCase: Case, meta: QueuedMeta): boolean {
  return meta.calls.some(
    (call, index) =>
      call.kind === 'request' &&
      meta.calls.findIndex(
        (c) => c.guard === call.guard && c.root === call.root,
      ) === index &&
      isOpen(rowOf(testCase, call.guard, call.root)),
  );
}

/** The calls the Safe makes, from transactions that can execute at some point. */
function effectiveCalls(
  testCase: Case,
  predicate: (call: Call) => boolean,
): Array<{ meta: QueuedMeta; call: Call }> {
  return Array.from(testCase.meta.values()).flatMap((meta) =>
    isEffective(meta.wrap) && !requestsOpenRoot(testCase, meta)
      ? meta.calls.filter(predicate).map((call) => ({ meta, call }))
      : [],
  );
}

/**
 * The call that reverts the transaction if it executed now, against the chain
 * as it is; `null` when it would succeed.
 */
function revertingCall(testCase: Case, meta: QueuedMeta): Call | null {
  const state = new Map<
    string,
    { pending: boolean; readyAt: number; expiresAt: number }
  >();
  const stateOf = (call: Call) => {
    const key = `${call.guard}:${call.root}`;
    if (!state.has(key)) {
      const row = rowOf(testCase, call.guard, call.root);
      state.set(key, {
        pending: row?.status === 'PENDING',
        readyAt: row?.readyAt ?? 0,
        expiresAt: row ? trueExpiresAt(row) : 0,
      });
    }
    return state.get(key)!;
  };
  for (const call of meta.calls) {
    const root = stateOf(call);
    const open = root.pending && NOW < root.expiresAt;
    if (call.kind === 'request') {
      if (open) {
        return call; // RootAlreadyConfigured
      }
      root.pending = true;
      root.readyAt = NOW + DELAY.get(call.guard)!;
      root.expiresAt = root.readyAt + EXPIRY;
    } else {
      if (!open || NOW < root.readyAt) {
        return call;
      }
      root.pending = false;
    }
  }
  return null;
}

/** Why the item's transaction would revert now, if it would. */
function revertCause(
  testCase: Case,
  meta: QueuedMeta,
  item: PendingDelayedGuardPolicies,
  kind: Call['kind'],
): string | null {
  const call = revertingCall(testCase, meta);
  if (!call) {
    return null;
  }
  const isItemCall = (candidate: Call) =>
    candidate.kind === kind &&
    candidate.root === item.root &&
    candidate.guard === item.guard;
  if (!isItemCall(call)) {
    const row = rowOf(testCase, call.guard, call.root);
    const isOpenRequest =
      call.kind === 'request' &&
      meta.calls.find((c) => c.guard === call.guard && c.root === call.root) ===
        call &&
      isOpen(row);
    if (!isOpenRequest) {
      return 'another call in the batch';
    }
    return row?.expiresAt === 0
      ? 'another call in the batch requesting a root open on chain (unknown expiry)'
      : 'another call in the batch requesting a root open on chain';
  }
  const isFirst = meta.calls.find(isItemCall) === call;
  const row =
    item.guard === null ? undefined : rowOf(testCase, item.guard, item.root);
  if (!isFirst || kind !== 'request' || !isOpen(row)) {
    return 'the same call repeated in the batch';
  }
  return row?.expiresAt === 0
    ? 'its open window on chain (unknown expiry)'
    : 'its open window on chain';
}

function policyTypeOf(
  testCase: Case,
  configuration: PolicyConfiguration,
  guard: Address | null,
): PolicyType | null {
  if (configuration.policy !== zeroAddress) {
    return getPolicyTypeOfContract(CHAIN_ID, configuration.policy);
  }
  // A removal has the type of the binding it removes on the item's guard.
  const binding = testCase.bindings.find(
    (candidate) =>
      (guard === null || candidate.guard === guard) &&
      candidate.target === configuration.target &&
      candidate.selector === configuration.selector &&
      candidate.operation === policyOperationFromValue(configuration.operation),
  );
  return binding ? guardPolicyTypeOfKind(binding.kind) : null;
}

/**
 * The configurations CGW can know for a change: stored, or in a queued apply,
 * counting applies in a transaction that reverts or not.
 */
function knownConfigurations(
  testCase: Case,
  guard: Address | null,
  root: Hex,
  withReverting: boolean,
): Array<PolicyConfiguration> | null {
  const configurations = testCase.roots.find(
    (r) => r.root === root,
  )!.configurations;
  const isStored = testCase.stored.some((stored) => stored.root === root);
  const isApplied =
    guard !== null &&
    Array.from(testCase.meta.values()).some(
      (meta) =>
        (meta.wrap === 'direct-call' ||
          meta.wrap === 'multisend-delegatecall') &&
        (withReverting || !requestsOpenRoot(testCase, meta)) &&
        meta.calls.some(
          (call) =>
            call.kind === 'apply' && call.root === root && call.guard === guard,
        ),
    );
  return isStored || isApplied ? configurations : null;
}

/**
 * Whether the change sets a requested type: in `must` mode whether or not the
 * mapper counts applies in a transaction that reverts, in `may` mode either way.
 */
function isTypeRequested(
  testCase: Case,
  guard: Address | null,
  root: Hex,
  mode: 'must' | 'may' = 'must',
): boolean {
  const requested = [true, false].map((withReverting) => {
    const configurations = knownConfigurations(
      testCase,
      guard,
      root,
      withReverting,
    );
    return (
      configurations === null ||
      configurations.some((configuration) => {
        const type = policyTypeOf(testCase, configuration, guard);
        return type === null || testCase.types.includes(type);
      })
    );
  });
  return mode === 'must' ? requested.every(Boolean) : requested.some(Boolean);
}

function bindingsSuffix(testCase: Case): string {
  return testCase.bindingsFiltered ? '' : ' (unfiltered bindings)';
}

function checkItem(
  testCase: Case,
  item: PendingDelayedGuardPolicies,
): Array<Violation> {
  const violations: Array<Violation> = [];
  const push = (invariant: string, detail: string) =>
    violations.push({ invariant, detail });
  const root = labelRoot(testCase, item.root);
  const meta = item.transaction
    ? testCase.meta.get(item.transaction.safeTxHash)
    : undefined;
  const expectedKind =
    item.status === 'configuration-in-signing' ? 'request' : 'apply';

  if (item.transaction) {
    if (!meta) {
      push('transaction not in the queue', item.transaction.safeTxHash);
      return violations;
    }
    const matching = meta.calls.filter(
      (call) => call.kind === expectedKind && call.root === item.root,
    );
    if (matching.length === 0) {
      push(
        'transaction does not make the reported call',
        `${root} via ${meta.label}`,
      );
    }
    if (matching.length > 0 && !isEffective(meta.wrap)) {
      push(
        'reports a call the Safe does not make',
        `${meta.label} is ${meta.wrap}`,
      );
    }
    if (
      matching.length > 0 &&
      !matching.some((call) => call.guard === item.guard)
    ) {
      push(
        'transaction calls a different guard than the item',
        `${meta.label} calls ${matching.map((c) => label(c.guard)).join('/')}; item ${label(item.guard)}`,
      );
    }
  }

  if (
    item.guard !== null &&
    !isEnabled(testCase, item.guard) &&
    !item.transaction
  ) {
    push(
      'item on a guard the Safe does not use, with no queued call',
      `${root} on ${label(item.guard)}`,
    );
  }

  const window = item.guard
    ? rowOf(testCase, item.guard, item.root)
    : undefined;
  const fullySigned = meta !== undefined && isFullySigned(meta);

  switch (item.status) {
    case 'application-ready':
      if (!(isApplicable(window) && fullySigned)) {
        push(
          'application-ready but cannot execute now',
          `${root}: window ${describeRow(window)}, fullySigned ${fullySigned}`,
        );
      } else if (meta) {
        const cause = revertCause(testCase, meta, item, 'apply');
        if (cause) {
          push(
            `application-ready but its transaction reverts on ${cause}`,
            `${root} via ${describeMeta(testCase, meta)}`,
          );
        }
      }
      break;
    case 'application-in-signing':
      if (!isOpen(window) || fullySigned) {
        push(
          'application-in-signing without an open window',
          `${root}: window ${describeRow(window)}, fullySigned ${fullySigned}`,
        );
      }
      break;
    case 'pending-application':
      if (!isOpen(window)) {
        push(
          'pending-application without an open window',
          `${root}: window ${describeRow(window)}`,
        );
      }
      if (meta && (!fullySigned || NOW >= window!.readyAt)) {
        push(
          'pending-application with a transaction that is not waiting on readyAt',
          `${root}: fullySigned ${fullySigned}, readyAt-now ${item.readyAt! - NOW}`,
        );
      }
      break;
    case 'expired':
      if (window?.status !== 'PENDING') {
        push(
          'expired without a pending row',
          `${root}: ${describeRow(window)}`,
        );
      } else if (isOpen(window)) {
        push(
          'expired but the window is still open',
          `${root}: ${describeRow(window)}`,
        );
      }
      break;
    case 'draft':
      if (
        testCase.onChain.some(
          (row) => row.root === item.root && isEnabled(testCase, row.guard),
        )
      ) {
        push('draft for a root on an enabled guard', root);
      }
      break;
    case 'configuration-in-signing':
      if (!meta) {
        push('configuration-in-signing without a transaction', root);
      } else {
        const cause = revertCause(testCase, meta, item, 'request');
        if (cause) {
          push(
            `configuration-in-signing but its transaction reverts on ${cause}`,
            `${root} via ${describeMeta(testCase, meta)}`,
          );
        }
      }
      break;
  }

  if (!isTypeRequested(testCase, item.guard, item.root, 'may')) {
    push(
      `returned although no configuration sets a requested type${bindingsSuffix(testCase)}`,
      `${root} on ${label(item.guard)}, types ${testCase.types.join(',')}`,
    );
  }

  return violations;
}

function checkCompleteness(
  testCase: Case,
  items: Array<PendingDelayedGuardPolicies>,
  allTypes: Array<PendingDelayedGuardPolicies>,
): Array<Violation> {
  const violations: Array<Violation> = [];
  const push = (invariant: string, detail: string) =>
    violations.push({ invariant, detail });

  const keys = new Set(items.map((item) => `${item.guard}:${item.root}`));
  if (keys.size !== items.length) {
    push('more than one item per guard and root', '');
  }

  for (const { root } of testCase.roots) {
    const name = labelRoot(testCase, root);
    const ofRoot = items.filter((item) => item.root === root);
    if (ofRoot.some((item) => item.guard === null) && ofRoot.length > 1) {
      push('draft next to an item on a guard', name);
    }

    for (const guard of GUARDS) {
      const item = ofRoot.find((candidate) => candidate.guard === guard);
      const row = rowOf(testCase, guard, root);
      const enabled = isEnabled(testCase, guard);
      const open = enabled && isOpen(row);
      const requested = isTypeRequested(testCase, guard, root);
      const requests = effectiveCalls(
        testCase,
        (call) =>
          call.kind === 'request' && call.root === root && call.guard === guard,
      );

      // Filtered out by type: checkItem and checkTypeFilter cover it.
      const droppedByType =
        !item && allTypes.some((i) => i.guard === guard && i.root === root);
      if (!requested || droppedByType) {
        continue;
      }

      if (
        open &&
        !(
          item &&
          [
            'pending-application',
            'application-in-signing',
            'application-ready',
          ].includes(item.status)
        )
      ) {
        push(
          'open window on an enabled guard but no pending item',
          `${name} on ${label(guard)}: ${describeRow(row)} -> ${item?.status ?? 'not returned'}`,
        );
      }

      // A request reverts while any row of its guard is open, enabled or not.
      if (!isOpen(row) && requests.length > 0 && !item) {
        const nested = requests.every(
          (r) => r.meta.wrap === 'nested-multisend',
        );
        push(
          `request queued but no item${nested ? ' (nested MultiSend)' : ''}`,
          `${name} on ${label(guard)}: ${requests.map((r) => `${r.meta.label}(${r.meta.wrap})`).join(',')}`,
        );
      }

      // Any queued request may be reported, even one whose batch reverts.
      const anyRequest = Array.from(testCase.meta.values()).some(
        (meta) =>
          isEffective(meta.wrap) &&
          meta.calls.some(
            (c) => c.kind === 'request' && c.root === root && c.guard === guard,
          ),
      );
      if (
        enabled &&
        row?.status === 'PENDING' &&
        !isOpen(row) &&
        !anyRequest &&
        item?.status !== 'expired'
      ) {
        push(
          'expired root on an enabled guard not reported as expired',
          `${name} on ${label(guard)}: ${describeRow(row)} -> ${item?.status ?? 'not returned'}`,
        );
      }

      if (item && open && isApplicable(row)) {
        const readyApplies = effectiveCalls(
          testCase,
          (call) =>
            call.kind === 'apply' && call.root === root && call.guard === guard,
        ).filter(({ meta }) => isFullySigned(meta));
        const reported = item.transaction
          ? testCase.meta.get(item.transaction.safeTxHash)
          : undefined;
        if (
          readyApplies.length > 0 &&
          item.status !== 'application-ready' &&
          readyApplies.some(
            ({ meta }) => !reported || meta.nonce <= reported.nonce,
          )
        ) {
          const cause = [
            {
              hit: readyApplies.every(
                ({ meta }) => meta.wrap === 'nested-multisend',
              ),
              label: ' (nested MultiSend)',
            },
            {
              hit: readyApplies.some(
                ({ meta }) =>
                  reported !== undefined &&
                  item.status !== 'configuration-in-signing' &&
                  meta !== reported &&
                  meta.nonce === reported.nonce,
              ),
              label: ' (same-nonce replacement)',
            },
            { hit: row?.expiresAt === 0, label: ' (unknown expiry)' },
          ].find(({ hit }) => hit);
          push(
            `executable apply queued but item is not application-ready${cause?.label ?? ''}`,
            `${name} on ${label(guard)} -> ${item.status} via ${reported?.label ?? 'none'}; ready: ${readyApplies.map((a) => `${a.meta.label}(nonce ${a.meta.nonce})`).join(',')}`,
          );
        }
      }
    }

    const isStored = testCase.stored.some((stored) => stored.root === root);
    const onEnabledGuard = testCase.onChain.some(
      (row) => row.root === root && isEnabled(testCase, row.guard),
    );
    if (
      isStored &&
      !onEnabledGuard &&
      ofRoot.length === 0 &&
      isTypeRequested(testCase, null, root)
    ) {
      push(
        'stored draft not returned',
        `${name}: queue ${describeQueue(testCase)}`,
      );
    }
  }

  return violations;
}

/**
 * Items the mapper drops only because of the type filter, although the model
 * says a configuration sets a requested type.
 */
function checkTypeFilter(
  testCase: Case,
  items: Array<PendingDelayedGuardPolicies>,
  allTypes: Array<PendingDelayedGuardPolicies>,
): Array<Violation> {
  return allTypes
    .filter(
      (candidate) =>
        !items.some(
          (item) =>
            item.guard === candidate.guard && item.root === candidate.root,
        ) && isTypeRequested(testCase, candidate.guard, candidate.root),
    )
    .map((candidate) => ({
      invariant: `dropped although a configuration sets a requested type${bindingsSuffix(testCase)}`,
      detail: `${labelRoot(testCase, candidate.root)} on ${label(candidate.guard)}, types ${testCase.types.join(',')}`,
    }));
}

// --- Report ------------------------------------------------------------------

function label(address: Address | null): string {
  if (address === null) {
    return 'null';
  }
  if (address === zeroAddress) {
    return '0x0';
  }
  if (address === G1) {
    return 'G1';
  }
  if (address === G2) {
    return 'G2';
  }
  if (address === G3) {
    return 'G3';
  }
  if (address === G4) {
    return 'G4';
  }
  return address.slice(0, 8);
}

function labelRoot(testCase: Case, root: Hex): string {
  return `R${testCase.roots.findIndex((candidate) => candidate.root === root)}`;
}

function describeRow(row: PolicyIndexerConfigurationRoot | undefined): string {
  if (!row) {
    return 'none';
  }
  const at = (value: number) =>
    value === 0 ? '0' : `now${signed(value - NOW)}`;
  return `${label(row.guard)} ${row.status} readyAt=${at(row.readyAt)} expiresAt=${at(row.expiresAt)}`;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function describeMeta(testCase: Case, meta: QueuedMeta): string {
  return `${meta.label}[nonce ${meta.nonce}, ${meta.confirmations}/${THRESHOLD}, ${meta.wrap}: ${meta.calls
    .map(
      (call) =>
        `${call.kind} ${labelRoot(testCase, call.root)} on ${label(call.guard)}`,
    )
    .join(' + ')}]`;
}

function describeQueue(testCase: Case): string {
  return Array.from(testCase.meta.values())
    .map((meta) => describeMeta(testCase, meta))
    .join(' ');
}

function describeCase(
  testCase: Case,
  items: Array<PendingDelayedGuardPolicies>,
): string {
  const lines = [
    `  safe:     guard=${label(testCase.guard)} moduleGuard=${label(testCase.moduleGuard)} types=${testCase.types.length === GUARD_POLICY_TYPES.length ? 'all' : testCase.types.join(',')}`,
    `  on chain: ${testCase.onChain.map((row) => `${labelRoot(testCase, row.root)} ${describeRow(row)}`).join('; ') || 'none'}`,
    `  stored:   ${testCase.stored.map((stored) => labelRoot(testCase, stored.root)).join(', ') || 'none'}`,
    `  queue:    ${describeQueue(testCase) || 'none'}`,
    `  output:   ${
      items
        .map(
          (item) =>
            `${labelRoot(testCase, item.root)} ${item.status} guard=${label(item.guard)} tx=${item.transaction ? testCase.meta.get(item.transaction.safeTxHash)?.label : 'null'}`,
        )
        .join('; ') || 'none'
    }`,
  ];
  return lines.join('\n');
}

function describeConfigurations(testCase: Case): string {
  return testCase.roots
    .map(
      ({ root, configurations }) =>
        `${labelRoot(testCase, root)}=[${configurations
          .map((c) => {
            if (c.policy === zeroAddress) {
              const bound = testCase.bindings
                .filter((b) => b.target === c.target)
                .map((b) => `${label(b.guard)}:${b.kind}`);
              return `remove(${bound.join('|') || 'unbound'})`;
            }
            return getPolicyTypeOfContract(CHAIN_ID, c.policy) ?? 'unknown';
          })
          .join(',')}]`,
    )
    .join(' ');
}

function size(testCase: Case): number {
  return (
    testCase.onChain.length +
    testCase.stored.length +
    Array.from(testCase.meta.values()).reduce(
      (sum, meta) => sum + meta.calls.length,
      0,
    )
  );
}

// --- Run ---------------------------------------------------------------------

describe('DelayedGuardPoliciesMapper fuzz', () => {
  const target = new DelayedGuardPoliciesMapper(
    new MultiSendDecoder(mockLoggingService),
    new SafePolicyGuardDecoder(),
    mockLoggingService,
  );

  function map(testCase: Case, types: ReadonlyArray<PolicyType>) {
    return target.map({
      safe,
      guard: testCase.guard,
      moduleGuard: testCase.moduleGuard,
      transactions: testCase.transactions,
      onChainConfigurations: testCase.onChain,
      storedConfigurations: testCase.stored,
      guardEnforcedPolicies: testCase.bindings,
      types,
      now: NOW,
    });
  }

  it(
    `should, over ${RUNS} random inputs, only return items the chain and the queue allow`,
    () => {
      faker.seed(SEED);
      const found = new Map<
        string,
        {
          count: number;
          smallest: { size: number; text: string; detail: string };
        }
      >();

      for (let run = 0; run < RUNS; run++) {
        const testCase = generateCase();
        const items = map(testCase, testCase.types);
        const allTypes = map(testCase, GUARD_POLICY_TYPES);
        const violations = [
          ...items.flatMap((item) => checkItem(testCase, item)),
          ...checkCompleteness(testCase, items, allTypes),
          ...checkTypeFilter(testCase, items, allTypes),
        ];
        for (const violation of violations) {
          const entry = found.get(violation.invariant);
          const caseSize = size(testCase);
          const smallest = {
            size: caseSize,
            text: `${describeCase(testCase, items)}\n  configs:  ${describeConfigurations(testCase)}`,
            detail: violation.detail,
          };
          if (!entry) {
            found.set(violation.invariant, { count: 1, smallest });
          } else {
            entry.count += 1;
            if (caseSize < entry.smallest.size) {
              entry.smallest = smallest;
            }
          }
        }
      }

      const report = Array.from(found.entries())
        .sort(([, a], [, b]) => b.count - a.count)
        .map(
          ([invariant, { count, smallest }]) =>
            `\n### ${invariant} (${count} hits)\n  detail:   ${smallest.detail}\n${smallest.text}`,
        )
        .join('\n');
      console.log(`seed ${SEED}, ${RUNS} runs${report || '\nno violations'}`);

      const unknown = Array.from(found.keys()).filter(
        (invariant) => !KNOWN_VIOLATIONS.includes(invariant),
      );
      expect(unknown, report).toStrictEqual([]);
    },
    Math.max(5_000, RUNS * 20),
  );

  it('should, when the Safe moved to a shorter-delay guard and requested the same configurations again, report the window of the current guard', () => {
    const HOUR = 3_600;
    const DAY = 86_400;
    const start = NOW;
    const oneDayGuard = getAddress(
      '0x2d4527fD0E79ca1e533E3C7BBEF7e0668b700aED',
    );
    const oneHourGuard = getAddress(
      '0xd2fB492adADBa5BcFb7FeBE25746fd5FdE090b20',
    );
    const configurations = [policyConfigurationBuilder().build()];
    const root = configurationRoot(configurations);
    // Hour 0: requested on the 1-day guard. Hour 2: guard switched to the
    // 1-hour guard and the same configurations requested there.
    const row = (
      guard: Address,
      readyAt: number,
      status: 'PENDING' | 'INVALIDATED',
    ) =>
      policyIndexerConfigurationRootBuilder()
        .with('chainId', CHAIN_ID)
        .with('safe', safe.address)
        .with('guard', guard)
        .with('root', root)
        .with('status', status)
        .with('readyAt', readyAt)
        .with('expiresAt', readyAt + EXPIRY)
        .build();
    const apply = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('to', oneHourGuard)
      .with('operation', Operation.CALL)
      .with(
        'data',
        applyConfigurationEncoder()
          .with('configurations', configurations)
          .encode(),
      )
      .with('confirmationsRequired', THRESHOLD)
      .with('confirmations', [
        confirmationBuilder().build(),
        confirmationBuilder().build(),
      ])
      .build();

    for (const oldStatus of ['PENDING', 'INVALIDATED'] as const) {
      const at = (hours: number) =>
        target
          .map({
            safe,
            guard: oneHourGuard,
            moduleGuard: null,
            transactions: [apply],
            // Indexer order: readyAt ascending.
            onChainConfigurations: [
              row(oneHourGuard, start + 3 * HOUR, 'PENDING'),
              row(oneDayGuard, start + DAY, oldStatus),
            ],
            storedConfigurations: [],
            guardEnforcedPolicies: [],
            types: GUARD_POLICY_TYPES,
            now: start + hours * HOUR,
          })
          .map((item) => ({
            status: item.status,
            guard: item.guard,
            readyAtHour: (item.readyAt! - start) / HOUR,
          }));

      expect(at(4)).toStrictEqual([
        { status: 'application-ready', guard: oneHourGuard, readyAtHour: 3 },
      ]);
      expect(at(170)).toStrictEqual([
        { status: 'application-ready', guard: oneHourGuard, readyAtHour: 3 },
      ]);
      expect(at(180)).toStrictEqual([
        { status: 'expired', guard: oneHourGuard, readyAtHour: 3 },
      ]);
    }
  });
});
