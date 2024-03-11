import { UnprocessableEntityException } from '@nestjs/common';

export class UnofficialMasterCopyError extends UnprocessableEntityException {
  constructor() {
    super(
      'Safe attempting to relay is not official. Only official Safe singletons are supported.',
    );
  }
}
