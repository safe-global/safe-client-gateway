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
} from './analysis-result.builder';
import type { ThreatStatus } from '../../threat-status.entity';

/**
 * Builder for RecipientAnalysisResponse
 */
export function recipientAnalysisResponseBuilder(): IBuilder<RecipientAnalysisResponse> {
  return new Builder<RecipientAnalysisResponse>().with(
    faker.finance.ethereumAddress() as `0x${string}`,
    {
      RECIPIENT_INTERACTION: [recipientAnalysisResultBuilder().build()],
      BRIDGE: [recipientAnalysisResultBuilder().build()],
    },
  );
}

/**
 * Builder for ContractAnalysisResponse
 */
export function contractAnalysisResponseBuilder(): IBuilder<ContractAnalysisResponse> {
  return new Builder<ContractAnalysisResponse>().with(
    faker.finance.ethereumAddress() as `0x${string}`,
    {
      CONTRACT_VERIFICATION: [contractAnalysisResultBuilder().build()],
      CONTRACT_INTERACTION: [contractAnalysisResultBuilder().build()],
      DELEGATECALL: [contractAnalysisResultBuilder().build()],
    },
  );
}

/**
 * Builder for ThreatAnalysisResponse
 * @param type - Optional threat type to build. Delegates to appropriate builder based on type.
 */
export function threatAnalysisResponseBuilder(
  type?: ThreatStatus,
): IBuilder<ThreatAnalysisResponse> {
  let threatResult;
  if (type === 'MASTER_COPY_CHANGE') {
    threatResult = masterCopyChangeThreatBuilder().build();
  } else if (type === 'MALICIOUS' || type === 'MODERATE') {
    threatResult = maliciousOrModerateThreatBuilder()
      .with('type', type)
      .build();
  } else if (type) {
    threatResult = threatAnalysisResultBuilder().with('type', type).build();
  } else {
    threatResult = threatAnalysisResultBuilder().build();
  }

  return new Builder<ThreatAnalysisResponse>()
    .with('THREAT', [threatResult])
    .with('BALANCE_CHANGE', []);
}

/**
 * Builder for CounterpartyAnalysisResponse
 */
export function counterpartyAnalysisResponseBuilder(): IBuilder<CounterpartyAnalysisResponse> {
  return new Builder<CounterpartyAnalysisResponse>()
    .with('recipient', recipientAnalysisResponseBuilder().build())
    .with('contract', contractAnalysisResponseBuilder().build());
}
