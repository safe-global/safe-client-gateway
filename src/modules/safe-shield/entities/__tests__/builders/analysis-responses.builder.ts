import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import {
  type RecipientAnalysisResponse,
  type ContractAnalysisResponse,
  type ThreatAnalysisResponse,
} from '../../analysis-responses.entity';
import { Severity } from '../../severity.entity';
import { ThreatStatus } from '../../threat-status.entity';
import {
  contractAnalysisResultBuilder,
  recipientAnalysisResultBuilder,
} from '@/modules/safe-shield/entities/__tests__/builders';
import {
  ContractStatusGroup,
  RecipientStatusGroup,
} from '@/modules/safe-shield/entities/status-group.entity';

/**
 * Builder for RecipientAnalysisResponse
 */
export function recipientAnalysisResponseBuilder(): IBuilder<RecipientAnalysisResponse> {
  return new Builder<RecipientAnalysisResponse>().with(
    faker.finance.ethereumAddress() as `0x${string}`,
    {
      [RecipientStatusGroup.RECIPIENT_INTERACTION]: [
        recipientAnalysisResultBuilder().build(),
      ],
      [RecipientStatusGroup.BRIDGE]: [recipientAnalysisResultBuilder().build()],
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
      [ContractStatusGroup.CONTRACT_VERIFICATION]: [
        contractAnalysisResultBuilder().build(),
      ],
      [ContractStatusGroup.CONTRACT_INTERACTION]: [
        contractAnalysisResultBuilder().build(),
      ],
      [ContractStatusGroup.DELEGATECALL]: [
        contractAnalysisResultBuilder().build(),
      ],
    },
  );
}

/**
 * Builder for ThreatAnalysisResponse
 */
export function threatAnalysisResponseBuilder(): IBuilder<ThreatAnalysisResponse> {
  return new Builder<ThreatAnalysisResponse>()
    .with('severity', Severity.OK)
    .with('type', ThreatStatus.NO_THREAT)
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}
