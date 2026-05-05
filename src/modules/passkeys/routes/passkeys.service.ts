// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';

@Injectable()
export class PasskeysService {
  public constructor(
    @Inject(IPasskeysRepository)
    private readonly passkeysRepository: IPasskeysRepository,
  ) {}
}
