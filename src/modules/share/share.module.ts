import { Module } from '@nestjs/common';
import { ShareController } from '@/modules/share/routes/share.controller';
import { ShareService } from '@/modules/share/routes/share.service';
import { ShareImageGenerator } from '@/modules/share/helpers/share-image.generator';
import { ChainsModule } from '@/modules/chains/chains.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';

@Module({
  imports: [SafeRepositoryModule, ChainsModule],
  controllers: [ShareController],
  providers: [ShareService, ShareImageGenerator],
})
export class ShareModule {}
