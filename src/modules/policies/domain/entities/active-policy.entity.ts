// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * Token metadata as the wallet renders it.
 *
 * `symbol`, `decimals` and `logoUri` are nullable: a policy can reference a
 * token the Transaction Service does not know, and dropping the whole policy
 * over missing metadata would hide an enforced restriction from the user.
 */
export type PolicyTokenInfo = {
  address: Address;
  symbol: string | null;
  decimals: number | null;
  logoUri: string | null;
};

/**
 * An address plus its name from the space address book, when known.
 */
export type NamedAddress = {
  address: Address;
  name: string | null;
};

/** `ERC20TransferPolicy`: per token, the recipients the Safe may send to. */
export type Erc20TransferPolicyData = {
  allowlist: Array<{
    token: PolicyTokenInfo;
    recipients: Array<NamedAddress>;
  }>;
};

/** `CoSignerPolicy`: per token, the cosigner required above a threshold. */
export type CosignerPolicyData = {
  rules: Array<{
    token: PolicyTokenInfo;
    cosigner: NamedAddress;
    /**
     * TODO(WA-2914): `CoSignerPolicy` encodes only the cosigner address, so no
     * threshold can be derived from the indexed event. Left `null` until the
     * wallet confirms the field or a policy variant that encodes one is used.
     */
    thresholdAmount: string | null;
  }>;
};

/** Module-enforced `spending-limit` (Phase 2). */
export type SpendingLimitPolicyData = {
  beneficiary: Address;
  limits: Array<{
    token: PolicyTokenInfo;
    amount: string;
    spent: string;
    nonce: string;
  }>;
};

/** Module-enforced `recovery` (Phase 2). */
export type RecoveryPolicyData = {
  recoverers: Array<Address>;
  cooldownSec: string;
  expirySec: string;
};

export type ActivePolicyData =
  | Erc20TransferPolicyData
  | CosignerPolicyData
  | SpendingLimitPolicyData
  | RecoveryPolicyData;

/**
 * A policy currently set on a Safe.
 *
 * `enabled` is `false` when the policy is configured but not enforced, which
 * happens when `configureImmediately` ran before the guard was set on the Safe.
 * The wallet uses it to prompt the user to enable the guard.
 */
export type ActivePolicy = {
  /** Opaque, stable identifier. Derived from the on-chain access word(s). */
  id: Hex;
  type: PolicyType;
  enforcement: PolicyEnforcement;
  enabled: boolean;
  data: ActivePolicyData;
};

/**
 * A configuration change requested through the guard's delayed path, not yet
 * applied.
 */
export type PendingPolicy = {
  /** `keccak256(abi.encode(Configuration[]))`, as requested on-chain. */
  configureRoot: Hex;
  /** Unix seconds of the `RootConfigured` event. */
  requestedAt: number;
  /** Unix seconds at which `applyConfiguration` becomes valid. */
  readyAt: number;
  isReady: boolean;
  /**
   * The requested change, when CGW can reconstruct it.
   *
   * TODO(WA-2914): `requestConfiguration(bytes32 root)` puts only the hash
   * on-chain - the `Configuration[]` is first revealed by `applyConfiguration` -
   * so nothing indexable describes a pending change. Populating this requires
   * persisting the submitted configurations at request time (pending product
   * decision); until then the pending change is reported untyped.
   */
  policy: ActivePolicy | null;
};
