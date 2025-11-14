import { HttpException, HttpStatus } from '@nestjs/common';

export class SubmissionNotFoundError extends HttpException {
  constructor() {
    super(`Submission not found`, HttpStatus.NOT_FOUND);
  }
}
