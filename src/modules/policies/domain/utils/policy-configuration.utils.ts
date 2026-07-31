// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyInfo } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import {
  accessSelector,
  policyOperationFromValue,
} from '@/modules/policies/domain/utils/policy-access.utils';
import { NULL_ADDRESS } from '@/routes/common/constants';

/**
 * The policy binding a stored `Configuration` describes.
 *
 * `id` is the on-chain access word, so a pending binding and the active policy of
 * the same access carry the same identifier and the wallet can line them up.
 * A zero policy address is a removal, reported as `policyContract: null`.
 */
export function toPolicyInfo(configuration: PolicyConfiguration): PolicyInfo {
  const operation = policyOperationFromValue(configuration.operation);
  const isRemoval =
    configuration.policy.toLowerCase() === NULL_ADDRESS.toLowerCase();

  return {
    id: accessSelector({
      target: configuration.target,
      selector: configuration.selector,
      operation,
    }),
    target: configuration.target,
    selector: configuration.selector,
    operation,
    policyContract: isRemoval ? null : configuration.policy,
  };
}
