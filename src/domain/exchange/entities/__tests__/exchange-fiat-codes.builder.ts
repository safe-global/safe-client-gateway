import { ExchangeFiatCodes } from '../exchange-fiat-codes.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function exchangeFiatCodesBuilder(): IBuilder<ExchangeFiatCodes> {
  return Builder.new<ExchangeFiatCodes>()
    .with('success', true)
    .with('symbols', { EUR: 'Euro' });
}
