import { Module } from '@nestjs/common';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/decoders/delay-modifier-decoder.helper';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/domain/contracts/decoders/safe-decoder.helper';

@Module({
  providers: [DelayModifierDecoder, MultiSendDecoder, SafeDecoder],
  exports: [DelayModifierDecoder, MultiSendDecoder, SafeDecoder],
})
export class AlertsDecodersModule {}
