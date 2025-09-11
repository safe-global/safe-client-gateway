import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import {
  type RecipientAnalysisResponse,
  type ContractAnalysisResponse,
  type ThreatAnalysisResponse,
} from '../../analysis-responses.entity';
import { Severity } from '../../severity.entity';
import {
  contractAnalysisResultBuilder,
  recipientAnalysisResultBuilder,
} from './analysis-result.builder';

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
 */
export function threatAnalysisResponseBuilder(): IBuilder<ThreatAnalysisResponse> {
  return new Builder<ThreatAnalysisResponse>()
    .with('severity', Severity.OK)
    .with('type', 'NO_THREAT')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}
