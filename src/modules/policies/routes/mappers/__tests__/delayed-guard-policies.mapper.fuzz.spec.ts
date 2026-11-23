// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hex, isAddressEqual } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  applyConfigurationEncoder,
  requestConfigurationEncoder,
} from '#/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { safePolicyGuardConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/safe-policy-guard-configuration.builder';
import { policyIndexerConfigurationRootBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/configuration-root.builder';
import type { PolicyIndexerConfigurationRoot } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PendingDelayedGuardPolicies } from '#/modules/policies/domain/entities/pending-policy.entity';
import type { SafePolicyGuardConfiguration } from '#/modules/policies/domain/entities/safe-policy-guard-configuration.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import {
  getSafePolicyGuardDeployments,
  POLICY_ENGINE_CHAIN_IDS,
} from '#/modules/policies/domain/policy-deployments.constants';
import { GUARD_POLICY_TYPES } from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { DelayedGuardPoliciesMapper } from '#/modules/policies/routes/mappers/delayed-guard-policies.mapper';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

const SEQUENCE_COUNT = 200;
const STEPS_PER_SEQUENCE = 30;
const MAX_QUEUE_LENGTH = 4;
const CONFIGURATION_SET_COUNT = 3;
const FUZZ_TIMEOUT_MS = 30_000;

const KNOWN_STATUSES = [
  'draft',
  'configuration-in-signing',
  'pending-application',
  'application-in-signing',
  'application-ready',
  'expired',
];

type ConfigurationSet = {
  configurations: SafePolicyGuardConfiguration['configurations'];
  root: Hex;
};

type QueuedCall = {
  kind: 'request' | 'apply';
  root: Hex;
  transaction: MultisigTransaction;
};

/** One Safe on one policy-engine chain, as the chain, CGW and the queue see it. */
type Model = {
  safe: SafeRef;
  guard: Address;
  delay: number;
  expiry: number;
  threshold: number;
  configurationSets: Array<ConfigurationSet>;
  roots: Array<PolicyIndexerConfigurationRoot>;
  stored: Array<SafePolicyGuardConfiguration>;
  queue: Array<QueuedCall>;
  now: number;
};

type Step =
  | { kind: 'store'; set: number }
  | { kind: 'delete-stored'; root: Hex }
  | {
      kind: 'queue-request' | 'queue-apply';
      set: number;
      confirmations: number;
    }
  | { kind: 'confirm'; safeTxHash: Hex }
  | { kind: 'execute' }
  | { kind: 'delete-queued'; safeTxHash: Hex }
  | { kind: 'invalidate'; root: Hex }
  | { kind: 'wait'; seconds: number };

describe('Delayed guard policy states', () => {
  it(
    'should, when random steps change the policy state of a Safe, keep every reported status known, consistent and leavable',
    () => {
      const mapper = new DelayedGuardPoliciesMapper(
        new MultiSendDecoder({
          debug: vi.fn(),
        } as MockedObject<ILoggingService>),
        new SafePolicyGuardDecoder(),
        { debug: vi.fn() } as MockedObject<ILoggingService>,
      );
      const map = (model: Model): Array<PendingDelayedGuardPolicies> =>
        mapper.map({
          safe: model.safe,
          guard: model.guard,
          moduleGuard: null,
          transactions: model.queue.map((call) => call.transaction),
          onChainConfigurations: model.roots,
          storedConfigurations: model.stored,
          guardEnforcedPolicies: [],
          types: GUARD_POLICY_TYPES,
          now: model.now,
        });
      const seenStatuses = new Set<string>();
      const seeds = faker.helpers.multiple(() => faker.number.int(), {
        count: SEQUENCE_COUNT,
      });

      for (const seed of seeds) {
        faker.seed(seed);
        let model = initialModel();
        const log = [
          `sequence seed ${seed}; the FAKER_SEED of this run replays every sequence`,
          `chain ${model.safe.chainId}, guard ${model.guard}, delay ${model.delay}, expiry ${model.expiry}, threshold ${model.threshold}, start ${model.now}`,
          `configuration sets ${model.configurationSets.map((set) => set.root).join(', ')}`,
        ];

        for (let index = 1; index <= STEPS_PER_SEQUENCE; index++) {
          const step = randomStep(model);
          model = applyStep(model, step);
          log.push(`${index}. ${JSON.stringify(step)}`);
          const context = log.join('\n');

          let items: Array<PendingDelayedGuardPolicies> = [];
          try {
            items = map(model);
          } catch (error) {
            expect.fail(
              `${context}\nthe mapper threw: ${asError(error).message}`,
            );
          }

          for (const item of items) {
            seenStatuses.add(item.status);
            assertItemInvariants({ model, item, context });
          }
          assertOneItemPerGuardAndRoot({ items, context });
          assertFinishedRootsAreNotReported({ model, items, context });
          assertNoDeadEnd({ model, items, map, context });
        }
      }

      expect([...seenStatuses].sort()).toStrictEqual(
        [...KNOWN_STATUSES].sort(),
      );
    },
    FUZZ_TIMEOUT_MS,
  );

  // Known gap: roots of a guard the Safe does not use are dropped before the
  // queued request is resolved, so its open window is not seen.
  it.fails('should, when a request is queued on a guard the Safe does not use while that guard holds an open window for the root, not report the request as being signed', () => {
    const mapper = new DelayedGuardPoliciesMapper(
      new MultiSendDecoder({ debug: vi.fn() } as MockedObject<ILoggingService>),
      new SafePolicyGuardDecoder(),
      { debug: vi.fn() } as MockedObject<ILoggingService>,
    );
    const chainId = faker.helpers.arrayElement([...POLICY_ENGINE_CHAIN_IDS]);
    const safe = {
      chainId,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const [safeGuard, otherGuard] = faker.helpers.shuffle(
      getSafePolicyGuardDeployments(chainId),
    );
    const root = configurationRoot([policyConfigurationBuilder().build()]);
    const now = Math.floor(faker.date.recent().getTime() / 1_000);
    const readyAt = now + faker.number.int({ min: 1, max: 86_400 });
    const openWindow = policyIndexerConfigurationRootBuilder()
      .with('chainId', chainId)
      .with('safe', safe.address)
      .with('guard', otherGuard)
      .with('root', root)
      .with('status', 'PENDING')
      .with('readyAt', readyAt)
      .with('expiresAt', readyAt + faker.number.int({ min: 1, max: 86_400 }))
      .build();
    const request = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('to', otherGuard)
      .with('operation', Operation.CALL)
      .with(
        'data',
        requestConfigurationEncoder().with('configureRoot', root).encode(),
      )
      .with('confirmationsRequired', 1)
      .with('confirmations', [])
      .build();

    const items = mapper.map({
      safe,
      guard: safeGuard,
      moduleGuard: null,
      transactions: [request],
      onChainConfigurations: [openWindow],
      storedConfigurations: [],
      guardEnforcedPolicies: [],
      types: GUARD_POLICY_TYPES,
      now,
    });

    expect(items.map((item) => item.status)).not.toContain(
      'configuration-in-signing',
    );
  });
});

function initialModel(): Model {
  const chainId = faker.helpers.arrayElement([...POLICY_ENGINE_CHAIN_IDS]);

  return {
    safe: { chainId, address: getAddress(faker.finance.ethereumAddress()) },
    guard: faker.helpers.arrayElement(getSafePolicyGuardDeployments(chainId)),
    delay: faker.number.int({ min: 60, max: 7 * 86_400 }),
    expiry: faker.number.int({ min: 60, max: 7 * 86_400 }),
    threshold: faker.number.int({ min: 1, max: 3 }),
    configurationSets: Array.from({ length: CONFIGURATION_SET_COUNT }, () => {
      const configurations: ConfigurationSet['configurations'] = [
        policyConfigurationBuilder().build(),
      ];
      return { configurations, root: configurationRoot(configurations) };
    }),
    roots: [],
    stored: [],
    queue: [],
    now: Math.floor(faker.date.recent().getTime() / 1_000),
  };
}

function randomStep(model: Model): Step {
  const unstoredSets = model.configurationSets
    .map((set, index) => ({ ...set, index }))
    .filter((set) => !isStored(model, set.root));
  const pendingRoots = model.roots.filter((row) => row.status === 'PENDING');
  const queueStep = (kind: 'queue-request' | 'queue-apply'): Step => ({
    kind,
    set: faker.number.int({ min: 0, max: CONFIGURATION_SET_COUNT - 1 }),
    confirmations: faker.number.int({ min: 0, max: model.threshold }),
  });
  const options: Array<{ weight: number; value: () => Step }> = [
    { weight: 3, value: () => ({ kind: 'wait', seconds: randomWait(model) }) },
  ];

  if (unstoredSets.length > 0) {
    options.push({
      weight: 2,
      value: () => ({
        kind: 'store',
        set: faker.helpers.arrayElement(unstoredSets).index,
      }),
    });
  }
  if (model.stored.length > 0) {
    options.push({
      weight: 1,
      value: () => ({
        kind: 'delete-stored',
        root: faker.helpers.arrayElement(model.stored).root,
      }),
    });
  }
  if (model.queue.length < MAX_QUEUE_LENGTH) {
    options.push(
      { weight: 3, value: () => queueStep('queue-request') },
      { weight: 3, value: () => queueStep('queue-apply') },
    );
  }
  if (model.queue.length > 0) {
    options.push(
      {
        weight: 3,
        value: () => ({
          kind: 'confirm',
          safeTxHash: faker.helpers.arrayElement(model.queue).transaction
            .safeTxHash,
        }),
      },
      {
        weight: 1,
        value: () => ({
          kind: 'delete-queued',
          safeTxHash: faker.helpers.arrayElement(model.queue).transaction
            .safeTxHash,
        }),
      },
    );
  }
  if (model.queue.length > 0 && isFullySigned(model.queue[0].transaction)) {
    options.push({ weight: 3, value: () => ({ kind: 'execute' }) });
  }
  if (pendingRoots.length > 0) {
    options.push({
      weight: 1,
      value: () => ({
        kind: 'invalidate',
        root: faker.helpers.arrayElement(pendingRoots).root,
      }),
    });
  }

  return faker.helpers.weightedArrayElement(options)();
}

/** Sometimes a short wait, sometimes up to or just past a window boundary. */
function randomWait(model: Model): number {
  const boundaries = model.roots
    .filter((row) => row.status === 'PENDING')
    .flatMap((row) => [row.readyAt, row.expiresAt])
    .filter((boundary) => boundary > model.now)
    .flatMap((boundary) => [boundary - model.now, boundary - model.now + 1]);

  return faker.helpers.arrayElement([
    faker.number.int({ min: 1, max: model.delay }),
    ...boundaries,
  ]);
}

function applyStep(model: Model, step: Step): Model {
  switch (step.kind) {
    case 'store': {
      const { configurations, root } = model.configurationSets[step.set];
      const stored = safePolicyGuardConfigurationBuilder()
        .with('chainId', model.safe.chainId)
        .with('safeAddress', model.safe.address)
        .with('root', root)
        .with('configurations', configurations)
        .with('createdAt', new Date(model.now * 1_000))
        .build();
      return { ...model, stored: [...model.stored, stored] };
    }
    case 'delete-stored': {
      return {
        ...model,
        stored: model.stored.filter((stored) => stored.root !== step.root),
      };
    }
    case 'queue-request':
    case 'queue-apply': {
      return { ...model, queue: [...model.queue, queuedCallOf(model, step)] };
    }
    case 'confirm': {
      return {
        ...model,
        queue: model.queue.map((call) =>
          call.transaction.safeTxHash === step.safeTxHash
            ? {
                ...call,
                transaction: {
                  ...call.transaction,
                  confirmations: [
                    ...(call.transaction.confirmations ?? []),
                    confirmationBuilder().build(),
                  ],
                },
              }
            : call,
        ),
      };
    }
    case 'execute': {
      return execute(model);
    }
    case 'delete-queued': {
      return {
        ...model,
        queue: model.queue.filter(
          (call) => call.transaction.safeTxHash !== step.safeTxHash,
        ),
      };
    }
    case 'invalidate': {
      return {
        ...model,
        roots: model.roots.map((row) =>
          row.root === step.root ? { ...row, status: 'INVALIDATED' } : row,
        ),
      };
    }
    case 'wait': {
      return { ...model, now: model.now + step.seconds };
    }
  }
}

function queuedCallOf(
  model: Model,
  step: Extract<Step, { kind: 'queue-request' | 'queue-apply' }>,
): QueuedCall {
  const { configurations, root } = model.configurationSets[step.set];
  const transaction = multisigTransactionBuilder()
    .with('safe', model.safe.address)
    .with('to', model.guard)
    .with('operation', Operation.CALL)
    .with(
      'data',
      step.kind === 'queue-request'
        ? requestConfigurationEncoder().with('configureRoot', root).encode()
        : applyConfigurationEncoder()
            .with('configurations', configurations)
            .encode(),
    )
    .with('value', '0')
    .with('isExecuted', false)
    .with('confirmationsRequired', model.threshold)
    .with(
      'confirmations',
      Array.from({ length: step.confirmations }, () =>
        confirmationBuilder().build(),
      ),
    )
    .with('submissionDate', new Date(model.now * 1_000))
    .build();

  return {
    kind: step.kind === 'queue-request' ? 'request' : 'apply',
    root,
    transaction,
  };
}

/**
 * Runs the first queued transaction. A call the guard reverts is executed as
 * failed: it leaves the queue and changes nothing on chain.
 */
function execute(model: Model): Model {
  const [next, ...rest] = model.queue;
  const row = rowOf(model, next.root);

  if (next.kind === 'request' && !(row && isWindowOpen(row, model.now))) {
    const readyAt = model.now + model.delay;
    const requested = policyIndexerConfigurationRootBuilder()
      .with('chainId', model.safe.chainId)
      .with('safe', model.safe.address)
      .with('guard', model.guard)
      .with('root', next.root)
      .with('status', 'PENDING')
      .with('readyAt', readyAt)
      .with('expiresAt', readyAt + model.expiry)
      .build();
    return {
      ...model,
      queue: rest,
      roots: row
        ? model.roots.map((other) => (other === row ? requested : other))
        : [...model.roots, requested],
    };
  }

  if (
    next.kind === 'apply' &&
    row &&
    isWindowOpen(row, model.now) &&
    model.now >= row.readyAt
  ) {
    return {
      ...model,
      queue: rest,
      roots: model.roots.map((other) =>
        other === row ? { ...row, status: 'APPLIED' } : other,
      ),
    };
  }

  return { ...model, queue: rest };
}

function assertItemInvariants(args: {
  model: Model;
  item: PendingDelayedGuardPolicies;
  context: string;
}): void {
  const { model, item } = args;
  const context = `${args.context}\nitem: ${JSON.stringify(item)}`;

  expect(KNOWN_STATUSES, context).toContain(item.status);

  if (item.status === 'draft') {
    expect(
      {
        guard: item.guard,
        transaction: item.transaction,
        readyAt: item.readyAt,
        expiresAt: item.expiresAt,
      },
      context,
    ).toStrictEqual({
      guard: null,
      transaction: null,
      readyAt: null,
      expiresAt: null,
    });
    return;
  }

  expect(item.guard && isAddressEqual(item.guard, model.guard), context).toBe(
    true,
  );
  const row = rowOf(model, item.root);
  const reportedCall = model.queue.find(
    (call) =>
      call.root === item.root &&
      call.transaction.safeTxHash === item.transaction?.safeTxHash,
  );

  switch (item.status) {
    case 'configuration-in-signing': {
      expect(reportedCall?.kind, context).toBe('request');
      expect(row && isWindowOpen(row, model.now), context).not.toBe(true);
      return;
    }
    case 'pending-application':
    case 'application-in-signing':
    case 'application-ready': {
      expect(row && isWindowOpen(row, model.now), context).toBe(true);
      expect(
        { readyAt: item.readyAt, expiresAt: item.expiresAt },
        context,
      ).toStrictEqual({ readyAt: row?.readyAt, expiresAt: row?.expiresAt });

      if (item.status === 'pending-application' && item.transaction === null) {
        expect(
          model.queue.some(
            (call) => call.kind === 'apply' && call.root === item.root,
          ),
          context,
        ).toBe(false);
      }
      if (item.status === 'pending-application' && item.transaction !== null) {
        expect(reportedCall?.kind, context).toBe('apply');
        expect(
          reportedCall && isFullySigned(reportedCall.transaction),
          context,
        ).toBe(true);
        expect(model.now, context).toBeLessThan(
          row?.readyAt ?? Number.NEGATIVE_INFINITY,
        );
      }
      if (item.status === 'application-in-signing') {
        expect(reportedCall?.kind, context).toBe('apply');
        expect(
          reportedCall && isFullySigned(reportedCall.transaction),
          context,
        ).toBe(false);
      }
      if (item.status === 'application-ready') {
        expect(reportedCall?.kind, context).toBe('apply');
        expect(
          reportedCall && isFullySigned(reportedCall.transaction),
          context,
        ).toBe(true);
        expect(model.now, context).toBeGreaterThanOrEqual(
          row?.readyAt ?? Number.POSITIVE_INFINITY,
        );
      }
      return;
    }
    case 'expired': {
      expect(row?.status, context).toBe('PENDING');
      expect(model.now, context).toBeGreaterThanOrEqual(
        row?.expiresAt ?? Number.POSITIVE_INFINITY,
      );
      expect(
        { readyAt: item.readyAt, expiresAt: item.expiresAt },
        context,
      ).toStrictEqual({ readyAt: row?.readyAt, expiresAt: row?.expiresAt });
      expect(
        model.queue.some(
          (call) => call.kind === 'request' && call.root === item.root,
        ),
        context,
      ).toBe(false);
      return;
    }
  }
}

function assertOneItemPerGuardAndRoot(args: {
  items: Array<PendingDelayedGuardPolicies>;
  context: string;
}): void {
  const keys = args.items.map(keyOf);

  expect(keys, args.context).toStrictEqual([...new Set(keys)]);
}

function assertFinishedRootsAreNotReported(args: {
  model: Model;
  items: Array<PendingDelayedGuardPolicies>;
  context: string;
}): void {
  const { model } = args;
  const reportedFinishedRoots = model.roots.filter(
    (row) =>
      row.status !== 'PENDING' &&
      !isStored(model, row.root) &&
      !model.queue.some((call) => call.root === row.root) &&
      args.items.some((item) => item.root === row.root),
  );

  expect(reportedFinishedRoots, args.context).toStrictEqual([]);
}

/**
 * Every reported item can be left. One step changes its status, removes it, or
 * drops one of the queued calls that keep it; the queue is finite, so the
 * status changes in the end.
 */
function assertNoDeadEnd(args: {
  model: Model;
  items: Array<PendingDelayedGuardPolicies>;
  map: (model: Model) => Array<PendingDelayedGuardPolicies>;
  context: string;
}): void {
  const stuck = new Map(
    args.items.map((item) => [
      keyOf(item),
      {
        status: item.status,
        queuedCalls: queuedCallsOf(args.model, item.root),
      },
    ]),
  );
  const tryStep = (step: Step): void => {
    const model = applyStep(args.model, step);
    const items = new Map(args.map(model).map((item) => [keyOf(item), item]));
    for (const [key, before] of stuck) {
      const item = items.get(key);
      if (
        !item ||
        item.status !== before.status ||
        queuedCallsOf(model, item.root) < before.queuedCalls
      ) {
        stuck.delete(key);
      }
    }
  };
  const steps = candidateSteps(args.model);
  const stepsOnReportedRoots = steps.filter((step) =>
    args.items.some((item) => isStepOnRoot(args.model, step, item.root)),
  );

  for (const step of [...stepsOnReportedRoots, ...steps]) {
    if (stuck.size === 0) {
      break;
    }
    tryStep(step);
  }

  expect(
    [...stuck.keys()],
    `${args.context}\nno single step changes, removes or moves these items forward`,
  ).toStrictEqual([]);
}

/** Every step the model allows next. */
function candidateSteps(model: Model): Array<Step> {
  return [
    ...model.queue.map(
      (call): Step => ({
        kind: 'delete-queued',
        safeTxHash: call.transaction.safeTxHash,
      }),
    ),
    ...model.stored.map(
      (stored): Step => ({ kind: 'delete-stored', root: stored.root }),
    ),
    ...model.roots
      .flatMap((row) => [row.readyAt, row.expiresAt])
      .filter((boundary) => boundary > model.now)
      .map(
        (boundary): Step => ({ kind: 'wait', seconds: boundary - model.now }),
      ),
    ...(model.queue.length > 0 && isFullySigned(model.queue[0].transaction)
      ? [{ kind: 'execute' } as const]
      : []),
    ...model.queue.map(
      (call): Step => ({
        kind: 'confirm',
        safeTxHash: call.transaction.safeTxHash,
      }),
    ),
    ...model.roots
      .filter((row) => row.status === 'PENDING')
      .map((row): Step => ({ kind: 'invalidate', root: row.root })),
    ...model.configurationSets.flatMap(
      (set, index): Array<Step> => [
        ...(isStored(model, set.root)
          ? []
          : [{ kind: 'store', set: index } as const]),
        { kind: 'queue-request', set: index, confirmations: 0 },
        { kind: 'queue-apply', set: index, confirmations: 0 },
      ],
    ),
    { kind: 'wait', seconds: 1 },
  ];
}

function isStepOnRoot(model: Model, step: Step, root: Hex): boolean {
  switch (step.kind) {
    case 'store':
    case 'queue-request':
    case 'queue-apply': {
      return model.configurationSets[step.set].root === root;
    }
    case 'delete-stored':
    case 'invalidate': {
      return step.root === root;
    }
    case 'confirm':
    case 'delete-queued': {
      return model.queue.some(
        (call) =>
          call.root === root && call.transaction.safeTxHash === step.safeTxHash,
      );
    }
    case 'execute': {
      return model.queue[0]?.root === root;
    }
    case 'wait': {
      const row = rowOf(model, root);
      return (
        row !== undefined &&
        [row.readyAt, row.expiresAt].includes(model.now + step.seconds)
      );
    }
  }
}

function rowOf(
  model: Model,
  root: Hex,
): PolicyIndexerConfigurationRoot | undefined {
  return model.roots.find((row) => row.root === root);
}

function isWindowOpen(
  row: PolicyIndexerConfigurationRoot,
  now: number,
): boolean {
  return row.status === 'PENDING' && now < row.expiresAt;
}

function isStored(model: Model, root: Hex): boolean {
  return model.stored.some((stored) => stored.root === root);
}

function isFullySigned(transaction: MultisigTransaction): boolean {
  return (
    (transaction.confirmations?.length ?? 0) >=
    transaction.confirmationsRequired
  );
}

function queuedCallsOf(model: Model, root: Hex): number {
  return model.queue.filter((call) => call.root === root).length;
}

function keyOf(item: PendingDelayedGuardPolicies): string {
  return `${item.guard?.toLowerCase() ?? 'draft'}:${item.root}`;
}
