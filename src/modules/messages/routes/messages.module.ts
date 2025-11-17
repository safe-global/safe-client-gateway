import { Module } from '@nestjs/common';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { MessageMapper } from '@/modules/messages/routes/mappers/message-mapper';
import { MessagesController } from '@/modules/messages/routes/messages.controller';
import { MessagesService } from '@/modules/messages/routes/messages.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { MessagesRepositoryModule } from '@/modules/messages/domain/messages.repository.interface';
import { SafeAppsRepositoryModule } from '@/modules/safe-apps/domain/safe-apps.repository.interface';

@Module({
  imports: [
    AddressInfoModule,
    MessagesRepositoryModule,
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessageMapper],
})
export class MessagesModule {}
