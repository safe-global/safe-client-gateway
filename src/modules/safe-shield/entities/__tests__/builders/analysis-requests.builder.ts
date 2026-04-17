// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { typedDataBuilder } from '@/modules/messages/routes/entities/__tests__/typed-data.builder';
import type { CounterpartyAnalysisRequestDto } from '@/modules/safe-shield/entities/dtos/counterparty-analysis-request.dto';
import type { ThreatAnalysisRequest } from '../../analysis-requests.entity';

/**
 * Builder for CounterpartyAnalysisRequest
 */
export function counterpartyAnalysisRequestDtoBuilder(): IBuilder<CounterpartyAnalysisRequestDto> {
  return new Builder<CounterpartyAnalysisRequestDto>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
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
