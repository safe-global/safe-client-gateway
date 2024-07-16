import { SanctionedAddressesService } from '@/routes/sanctioned-addresses/sanctioned-addresses.service';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('sanctioned-addresses')
@Controller({
  version: '1',
})
export class SanctionedAddressesController {
  constructor(
    private readonly sanctionedAddressesService: SanctionedAddressesService,
  ) {}

  @Get('sanctioned-addresses')
  async getSanctionedAddresses(): Promise<Array<`0x${string}`>> {
    return this.sanctionedAddressesService.getSanctionedAddresses();
  }
}
