import { Module } from '@nestjs/common';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';

@Module({
  providers: [SafeDecoder, Erc20Decoder, MultiSendDecoder, ProxyFactoryDecoder],
  exports: [SafeDecoder, Erc20Decoder, MultiSendDecoder, ProxyFactoryDecoder],
})
export class RelayDecodersModule {}
