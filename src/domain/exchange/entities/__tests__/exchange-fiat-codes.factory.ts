import { ExchangeFiatCodes } from '../exchange-fiat-codes.entity';

export default function (
  success?: boolean,
  symbols?: Record<string, string>,
): ExchangeFiatCodes {
  return <ExchangeFiatCodes>{
    success: success ?? true,
    symbols: symbols ?? { EUR: 'Euro' },
  };
}
