import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import {
  type RecipientAnalysisResponse,
  type ContractAnalysisResponse,
  type ThreatAnalysisResponse,
  type CounterpartyAnalysisResponse,
} from '../../analysis-responses.entity';
import {
  contractAnalysisResultBuilder,
  recipientAnalysisResultBuilder,
  threatAnalysisResultBuilder,
  masterCopyChangeThreatBuilder,
  maliciousOrModerateThreatBuilder,
  unofficialFallbackHandlerAnalysisResultBuilder,
} from './analysis-result.builder';
import { ThreatStatus } from '../../threat-status.entity';
import { getAddress } from 'viem';
import {
  ContractStatusGroup,
  RecipientStatusGroup,
  ThreatStatusGroup,
} from '@/modules/safe-shield/entities/status-group.entity';
import { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';
import { ContractStatus } from '@/modules/safe-shield/entities/contract-status.entity';

/**
 * Builder for RecipientAnalysisResponse.
 *
 * @param withDefaults - If true (default), includes a random address with default data.
 *                       If false, returns an empty builder for custom configuration.
 * @returns Builder instance for RecipientAnalysisResponse
 *
 * @example
 * // With default random data
 * const response = recipientAnalysisResponseBuilder().build();
 *
 * @example
 * // Empty builder for custom data only
 * const response = recipientAnalysisResponseBuilder(false)
 *   .with('0x123...', { isSafe: true, ... })
 *   .build();
 */
export function recipientAnalysisResponseBuilder(
  withDefaults = true,
): IBuilder<RecipientAnalysisResponse> {
  const builder = new Builder<RecipientAnalysisResponse>();

  if (withDefaults) {
    builder.with(getAddress(faker.finance.ethereumAddress()), {
      isSafe: true,
      [RecipientStatusGroup.RECIPIENT_INTERACTION]: [
        recipientAnalysisResultBuilder().build(),
      ],
      [RecipientStatusGroup.RECIPIENT_ACTIVITY]: [
        recipientAnalysisResultBuilder()
          .with('type', RecipientStatus.LOW_ACTIVITY)
          .build(),
      ],
      [RecipientStatusGroup.BRIDGE]: [
        recipientAnalysisResultBuilder()
          .with('type', BridgeStatus.INCOMPATIBLE_SAFE)
          .build(),
      ],
    });
  }

  return builder;
}

/**
 * Builder for ContractAnalysisResponse.
 *
 * @param withDefaults - If true (default), includes a random address with default data.
 *                       If false, returns an empty builder for custom configuration.
 * @returns Builder instance for ContractAnalysisResponse
 *
 * @example
 * // With default random data
 * const response = contractAnalysisResponseBuilder().build();
 *
 * @example
 * // Empty builder for custom data only
 * const response = contractAnalysisResponseBuilder(false)
 *   .with('0x123...', { logoUrl: '...', ... })
 *   .build();
 */
export function contractAnalysisResponseBuilder(
  withDefaults = true,
): IBuilder<ContractAnalysisResponse> {
  const builder = new Builder<ContractAnalysisResponse>();

  if (withDefaults) {
    builder.with(getAddress(faker.finance.ethereumAddress()), {
      logoUrl: faker.image.url(),
      name: faker.company.name(),
      [ContractStatusGroup.CONTRACT_VERIFICATION]: [
        contractAnalysisResultBuilder().build(),
      ],
      [ContractStatusGroup.CONTRACT_INTERACTION]: [
        contractAnalysisResultBuilder()
          .with('type', ContractStatus.KNOWN_CONTRACT)
          .build(),
      ],
      [ContractStatusGroup.DELEGATECALL]: [
        contractAnalysisResultBuilder()
          .with('type', ContractStatus.UNEXPECTED_DELEGATECALL)
          .build(),
      ],
      [ContractStatusGroup.FALLBACK_HANDLER]: [
        unofficialFallbackHandlerAnalysisResultBuilder().build(),
      ],
    });
  }

  return builder;
}

/**
 * Builder for ThreatAnalysisResponse
 * @param type - Optional threat type to build. Delegates to appropriate builder based on type.
 */
export function threatAnalysisResponseBuilder(
  type?: ThreatStatus,
): IBuilder<ThreatAnalysisResponse> {
  let threatResult;
  if (type === ThreatStatus.MASTERCOPY_CHANGE) {
    threatResult = masterCopyChangeThreatBuilder().build();
  } else if (
    type === ThreatStatus.MALICIOUS ||
    type === ThreatStatus.MODERATE
  ) {
    threatResult = maliciousOrModerateThreatBuilder()
      .with('type', type)
      .build();
  } else if (type) {
    threatResult = threatAnalysisResultBuilder().with('type', type).build();
  } else {
    threatResult = threatAnalysisResultBuilder().build();
  }

  return new Builder<ThreatAnalysisResponse>()
    .with(ThreatStatusGroup.THREAT, [threatResult])
    .with(ThreatStatusGroup.BALANCE_CHANGE, []);
}

/**
 * Builder for CounterpartyAnalysisResponse.
 *
 * @param withDefaults - If true (default), includes default random data for both recipient and contract.
 *                       If false, returns an empty builder for custom configuration.
 * @returns Builder instance for CounterpartyAnalysisResponse
 *
 * @example
 * // With default random data
 * const response = counterpartyAnalysisResponseBuilder().build();
 *
 * @example
 * // Empty builder for custom data only
 * const response = counterpartyAnalysisResponseBuilder(false)
 *   .with('recipient', { ... })
 *   .with('contract', { ... })
 *   .build();
 */
export function counterpartyAnalysisResponseBuilder(
  withDefaults = true,
): IBuilder<CounterpartyAnalysisResponse> {
  const builder = new Builder<CounterpartyAnalysisResponse>();

  if (withDefaults) {
    builder
      .with('recipient', recipientAnalysisResponseBuilder().build())
      .with('contract', contractAnalysisResponseBuilder().build());
  }

  return builder;
}
