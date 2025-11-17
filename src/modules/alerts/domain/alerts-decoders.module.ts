import { Module } from '@nestjs/common';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';

@Module({
  providers: [DelayModifierDecoder, MultiSendDecoder, SafeDecoder],
  exports: [DelayModifierDecoder, MultiSendDecoder, SafeDecoder],
})
export class AlertsDecodersModule {}
