// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { MaliciousAddressScanner } from '@/modules/safe-shield/malicious-address-scan/malicious-address-scanner.service';
import { BlockaidApiModule } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.module';

@Module({
  imports: [BlockaidApiModule],
  providers: [MaliciousAddressScanner],
  exports: [MaliciousAddressScanner],
})
export class MaliciousAddressScanModule {}
