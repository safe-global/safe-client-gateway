import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  MasterCopyChangeThreatAnalysisResult,
  MaliciousOrModerateThreatAnalysisResult,
} from '../../analysis-result.entity';
import {
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
  type ThreatAnalysisResult,
} from '../../analysis-result.entity';

/**
 * Builder for RecipientAnalysisResult entities
 */
export function recipientAnalysisResultBuilder(): IBuilder<RecipientAnalysisResult> {
  return new Builder<RecipientAnalysisResult>()
    .with('severity', 'OK')
    .with('type', 'RECURRING_RECIPIENT')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}

/**
 * Builder for ContractAnalysisResult entities
 */
export function contractAnalysisResultBuilder(): IBuilder<ContractAnalysisResult> {
  return new Builder<ContractAnalysisResult>()
    .with('severity', 'INFO')
    .with('type', 'VERIFIED')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}

/**
 * Builder for ThreatAnalysisResult entities (default: NO_THREAT)
 */
export function threatAnalysisResultBuilder(): IBuilder<ThreatAnalysisResult> {
  return new Builder<ThreatAnalysisResult>()
    .with('severity', 'OK')
    .with('type', 'NO_THREAT')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph());
}

/**
 * Builder for ThreatAnalysisResult with MASTER_COPY_CHANGE type
 */
export function masterCopyChangeThreatBuilder(): IBuilder<MasterCopyChangeThreatAnalysisResult> {
  return new Builder<MasterCopyChangeThreatAnalysisResult>()
    .with('severity', 'CRITICAL')
    .with('type', 'MASTER_COPY_CHANGE')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph())
    .with('before', faker.finance.ethereumAddress())
    .with('after', faker.finance.ethereumAddress());
}

/**
 * Builder for ThreatAnalysisResult with MODERATE/MALICIOUS type
 */
export function maliciousOrModerateThreatBuilder(): IBuilder<MaliciousOrModerateThreatAnalysisResult> {
  return new Builder<MaliciousOrModerateThreatAnalysisResult>()
    .with('severity', 'CRITICAL')
    .with('type', 'MALICIOUS')
    .with('title', faker.lorem.sentence())
    .with('description', faker.lorem.paragraph())
    .with('issues', new Map([['WARN', [faker.lorem.sentence()]]]));
}
