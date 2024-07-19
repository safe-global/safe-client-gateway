import { Inject, Injectable } from '@nestjs/common';
import { Event } from '@/routes/cache-hooks/entities/event.entity';
import { HooksRepository } from '@/domain/hooks/hooks.repository';
import { IHooksRepository } from '@/domain/hooks/hooks.repository.interface';

@Injectable()
export class CacheHooksService implements IHooksRepository {
  constructor(
    @Inject(IHooksRepository)
    private readonly hooksRepository: HooksRepository,
  ) {}

  async onEvent(event: Event): Promise<unknown> {
    return this.hooksRepository.onEvent(event);
  }
}
