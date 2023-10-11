import { Module } from '@nestjs/common';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { MessageMapper } from '@/routes/messages/mappers/message-mapper';
import { MessagesController } from '@/routes/messages/messages.controller';
import { MessagesService } from '@/routes/messages/messages.service';

@Module({
  controllers: [MessagesController],
  imports: [AddressInfoModule],
  providers: [MessagesService, MessageMapper],
})
export class MessagesModule {}
