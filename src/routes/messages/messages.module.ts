import { Module } from '@nestjs/common';
import { AddressInfoModule } from '../common/address-info/address-info.module';
import { MessageMapper } from './mappers/message-mapper';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController],
  imports: [AddressInfoModule],
  providers: [MessagesService, MessageMapper],
})
export class MessagesModule {}
