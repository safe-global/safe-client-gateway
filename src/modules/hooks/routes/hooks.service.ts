// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IHooksRepository } from '@/modules/hooks/domain/hooks.repository.interface';
import type { Event } from '@/modules/hooks/routes/entities/event.entity';

@Injectable()
export class HooksService {
  constructor(
    @Inject(IHooksRepository)
    private readonly hooksRepository: IHooksRepository,
  ) {}

  onEvent(event: Event): Promise<unknown> {
    return this.hooksRepository.onEvent(event);
  }
}
