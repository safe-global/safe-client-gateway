import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import {
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
  type ThreatAnalysisResult,
} from '../../analysis-result.entity';
import { Severity } from '../../severity.entity';
import { RecipientStatus } from '../../recipient-status.entity';
import { ContractStatus } from '../../contract-status.entity';
import { ThreatStatus } from '../../threat-status.entity';

/**
 * Builder for RecipientAnalysisResult entities
 */
export function recipientAnalysisResultBuilder(): IBuilder<RecipientAnalysisResult> {
  return new Builder<RecipientAnalysisResult>()
    .with('severity', Severity.INFO)
    .with('type', RecipientStatus.KNOWN_RECIPIENT)
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}

/**
 * Builder for ContractAnalysisResult entities
 */
export function contractAnalysisResultBuilder(): IBuilder<ContractAnalysisResult> {
  return new Builder<ContractAnalysisResult>()
    .with('severity', Severity.INFO)
    .with('type', ContractStatus.VERIFIED)
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}

/**
 * Builder for ThreatAnalysisResult entities
 */
export function threatAnalysisResultBuilder(): IBuilder<ThreatAnalysisResult> {
  return new Builder<ThreatAnalysisResult>()
    .with('severity', Severity.OK)
    .with('type', ThreatStatus.NO_THREAT)
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}
