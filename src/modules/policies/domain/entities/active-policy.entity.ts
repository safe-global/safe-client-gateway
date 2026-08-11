// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyOperation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
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
 * An address plus its name from the space address book.
 *
 * `name` is omitted rather than `null` when the address has no address book
 * entry: the wallet falls back to rendering the address either way, so an
 * explicit null carries no extra information.
 */
export type NamedAddress = {
  address: Address;
  name?: string;
};

/**
 * A recipient of an `ERC20TransferPolicy` allowlist.
 *
 * Address only, deliberately not a {@link NamedAddress}: the wallet resolves
 * display names itself, so the space address book is not consulted here.
 */
export type PolicyRecipient = {
  address: Address;
};

/** `ERC20TransferPolicy`: per token, the recipients the Safe may send to. */
export type Erc20TransferPolicyData = {
  allowlist: Array<{
    token: PolicyTokenInfo;
    recipients: Array<PolicyRecipient>;
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

/**
 * `AllowPolicy`: the access it covers is already carried by the item's `id` and
 * `enforcement`, and the confirmation's `data` is empty (`0x`, with no
 * `dataDecoded`), so there is nothing left to report.
 *
 * Kept as a distinct type rather than reusing an existing one so the `data`
 * union stays exhaustive per policy type.
 */
export type AllowPolicyData = Record<string, never>;

export type ActivePolicyData =
  | Erc20TransferPolicyData
  | CosignerPolicyData
  | SpendingLimitPolicyData
  | RecoveryPolicyData
  | AllowPolicyData;

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
   * One entry per `Configuration` of the request, in the order they were
   * submitted - the order the signers approved.
   *
   * `null` when CGW holds no configurations for this root: the request predates
   * the store, or was made outside the wallet. `requestConfiguration(bytes32
   * root)` publishes only the hash, so an unexplained root is a normal state -
   * and one the wallet has to tell apart from a known request, hence `null`
   * rather than an empty list. A stored request always has at least one
   * configuration, so an empty list never occurs.
   */
  policies: Array<PolicyInfo> | null;
};

/**
 * One policy binding of a request: which access it covers and which policy
 * contract it binds to it.
 *
 * Reports the binding, not the policy's payload - decoding `data` into
 * recipients, cosigners and the like is a separate step.
 */
export type PolicyInfo = {
  /** The access word, as used for a policy `id` in `/policies/active`. */
  id: Hex;
  target: Address;
  selector: Hex;
  operation: PolicyOperation;
  /** The policy contract the request binds, `null` for a removal. */
  policyContract: Address | null;
};
