import { Module } from '@nestjs/common';
import { SafeDecoder } from '@/domain/contracts/decoders/safe-decoder.helper';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/decoders/proxy-factory-decoder.helper';

@Module({
  providers: [SafeDecoder, Erc20Decoder, MultiSendDecoder, ProxyFactoryDecoder],
  exports: [SafeDecoder, Erc20Decoder, MultiSendDecoder, ProxyFactoryDecoder],
})
export class RelayDecodersModule {}
