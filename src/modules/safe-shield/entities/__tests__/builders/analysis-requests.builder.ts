import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { ThreatAnalysisRequest } from '../../analysis-requests.entity';
import { type Hex, getAddress } from 'viem';
import type { CounterpartyAnalysisRequestDto } from '@/modules/safe-shield/entities/dtos/counterparty-analysis-request.dto';

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
 * Builder for ThreatAnalysisRequestBody
 */
export function threatAnalysisRequestBodyBuilder(): IBuilder<ThreatAnalysisRequest> {
  return new Builder<ThreatAnalysisRequest>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
    .with('data', faker.string.hexadecimal({ length: 128 }) as Hex)
    .with('operation', faker.helpers.arrayElement([0, 1]))
    .with('safeTxGas', faker.string.numeric())
    .with('baseGas', faker.string.numeric())
    .with('gasPrice', faker.string.numeric())
    .with('gasToken', getAddress(faker.finance.ethereumAddress()))
    .with('refundReceiver', getAddress(faker.finance.ethereumAddress()))
    .with('nonce', faker.string.numeric())
    .with('walletAddress', getAddress(faker.finance.ethereumAddress()))
    .with('origin', faker.internet.url());
}
