// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';

describe('HttpExceptionNoLog', () => {
  it('should create a body with the message and status code', () => {
    const message = faker.lorem.sentence();
    const code = faker.helpers.enumValue(HttpStatus);

    const exception = new HttpExceptionNoLog(message, code);

    expect(exception.getStatus()).toBe(code);
    expect(JSON.parse(JSON.stringify(exception.getResponse()))).toStrictEqual({
      message,
      statusCode: code,
    });
  });

  it('should add the error label to the body when given', () => {
    const message = faker.lorem.sentence();
    const code = faker.helpers.enumValue(HttpStatus);
    const error = faker.lorem.word();

    const exception = new HttpExceptionNoLog(message, code, error);

    expect(exception.getStatus()).toBe(code);
    expect(exception.getResponse()).toStrictEqual({
      message,
      error,
      statusCode: code,
    });
  });
});
