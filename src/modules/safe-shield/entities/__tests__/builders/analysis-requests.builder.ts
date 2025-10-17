import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  RecipientAnalysisRequestBody,
  ContractAnalysisRequestBody,
  ThreatAnalysisRequest,
} from '../../analysis-requests.entity';
import { type Hex, getAddress } from 'viem';
import { typedDataBuilder } from '@/routes/messages/entities/__tests__/typed-data.builder';

/**
 * Builder for RecipientAnalysisRequestBody
 */
export function recipientAnalysisRequestBodyBuilder(): IBuilder<RecipientAnalysisRequestBody> {
  return new Builder<RecipientAnalysisRequestBody>().with(
    'data',
    faker.string.hexadecimal({ length: 128 }) as Hex,
  );
}

/**
 * Builder for ContractAnalysisRequestBody
 */
export function contractAnalysisRequestBodyBuilder(): IBuilder<ContractAnalysisRequestBody> {
  return new Builder<ContractAnalysisRequestBody>()
    .with('data', faker.string.hexadecimal({ length: 128 }) as Hex)
    .with('operation', faker.helpers.arrayElement([0, 1]));
}

/**
 * Builder for ThreatAnalysisRequest
 */
export function threatAnalysisRequestBuilder(): IBuilder<ThreatAnalysisRequest> {
  return new Builder<ThreatAnalysisRequest>()
    .with(
      'data',
      typedDataBuilder()
        .with('message', {
          [faker.lorem.word()]: faker.number.int(),
          [faker.lorem.word()]: getAddress(faker.finance.ethereumAddress()),
        })
        .build(),
    )
    .with('walletAddress', getAddress(faker.finance.ethereumAddress()))
    .with('origin', faker.internet.url());
}
