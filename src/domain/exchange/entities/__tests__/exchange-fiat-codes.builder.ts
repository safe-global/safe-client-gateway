import { Builder, IBuilder } from '@/__tests__/builder';
import { ExchangeFiatCodes } from '@/domain/exchange/entities/exchange-fiat-codes.entity';

export function exchangeFiatCodesBuilder(): IBuilder<ExchangeFiatCodes> {
  return Builder.new<ExchangeFiatCodes>()
    .with('success', true)
    .with('symbols', { EUR: 'Euro' });
}
