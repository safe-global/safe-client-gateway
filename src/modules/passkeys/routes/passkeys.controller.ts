// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PasskeysService } from '@/modules/passkeys/routes/passkeys.service';

@ApiTags('passkeys')
@Controller({ path: 'passkeys', version: '1' })
export class PasskeysController {
  public constructor(private readonly passkeysService: PasskeysService) {}
}
