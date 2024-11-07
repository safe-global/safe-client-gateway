import { ApiProperty } from '@nestjs/swagger';
import { Relay as DomainRelay } from '@/domain/relay/entities/relay.entity';

export class Relay implements DomainRelay {
  @ApiProperty()
  taskId: string;

  constructor(relay: DomainRelay) {
    this.taskId = relay.taskId;
  }
}
