import { HttpException, HttpStatus } from '@nestjs/common';

export class UnofficialMasterCopyError extends HttpException {
  constructor() {
    super(
      'Safe attempting to relay is not official. Only official Safe singletons are supported.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
