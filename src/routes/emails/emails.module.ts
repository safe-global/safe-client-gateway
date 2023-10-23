import { Module } from '@nestjs/common';
import { EmailsController } from '@/routes/emails/emails.controller';
import { EmailsService } from '@/routes/emails/emails.service';

@Module({
  controllers: [EmailsController],
  providers: [EmailsService],
})
export class EmailsModule {}
