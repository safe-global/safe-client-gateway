import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { MessageVerifierHelper } from '@/modules/messages/domain/helpers/message-verifier.helper';
import { MessagesRepository } from '@/modules/messages/domain/messages.repository';
import { IMessagesRepository } from '@/modules/messages/domain/messages.repository.interface';
import { MessageMapper } from '@/modules/messages/routes/mappers/message-mapper';
import { MessagesController } from '@/modules/messages/routes/messages.controller';
import { MessagesService } from '@/modules/messages/routes/messages.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { SafeAppsModule } from '@/modules/safe-apps/safe-apps.module';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';

@Module({
  imports: [
    AddressInfoModule,
    TransactionApiManagerModule,
    SafeRepositoryModule,
    SafeAppsModule,
  ],
  providers: [
    {
      provide: IMessagesRepository,
      useClass: MessagesRepository,
    },
    MessageVerifierHelper,
    MessagesService,
    MessageMapper,
  ],
  controllers: [MessagesController],
  exports: [IMessagesRepository],
})
export class MessagesModule {}
