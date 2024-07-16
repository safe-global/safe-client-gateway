import { SanctionedAddressesRepositoryModule } from '@/domain/sanctioned-addresses/sanctioned-addresses.repository.interface';
import { SanctionedAddressesController } from '@/routes/sanctioned-addresses/sanctioned-addresses.controller';
import { SanctionedAddressesService } from '@/routes/sanctioned-addresses/sanctioned-addresses.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [SanctionedAddressesRepositoryModule],
  controllers: [SanctionedAddressesController],
  providers: [SanctionedAddressesService],
})
export class SanctionedAddressesModule {}
