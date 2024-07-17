import { GoneException } from '@nestjs/common';

export class EventProtocolChangedError extends GoneException {
  constructor() {
    super('Protocol has been changed for this kind of event.');
  }
}
