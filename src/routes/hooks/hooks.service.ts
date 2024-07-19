import { Inject, Injectable } from '@nestjs/common';
import { Event } from '@/routes/hooks/entities/event.entity';
import { IHooksRepository } from '@/domain/hooks/hooks.repository.interface';

@Injectable()
export class HooksService {
  constructor(
    @Inject(IHooksRepository)
    private readonly hooksRepository: IHooksRepository,
  ) {}

  async onEvent(event: Event): Promise<unknown> {
    return this.hooksRepository.onEvent(event);
  }
}
