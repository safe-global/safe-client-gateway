import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import { Module } from '@nestjs/common';

const delayModifierDecoder = {
  decodeEventLog: jest.fn(),
};

const multiSendDecoder = {
  mapMultiSendTransactions: jest.fn(),
};

const safeDecoder = {
  decodeFunctionData: jest.fn(),
};

@Module({
  providers: [
    {
      provide: DelayModifierDecoder,
      useFactory: () => jest.mocked(delayModifierDecoder),
    },
    {
      provide: MultiSendDecoder,
      useFactory: () => jest.mocked(multiSendDecoder),
    },
    {
      provide: SafeDecoder,
      useFactory: () => jest.mocked(safeDecoder),
    },
  ],
  exports: [DelayModifierDecoder, MultiSendDecoder, SafeDecoder],
})
export class TestAlertsDecodersModule {}
