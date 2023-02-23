import { faker } from '@faker-js/faker';
import { HttpException } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from './generic.validator';
import { ValidationErrorFactory } from './validation-error-factory';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as unknown as ValidationErrorFactory);

describe('Generic validator', () => {
  const genericValidator = new GenericValidator(mockValidationErrorFactory);

  it('should throw a validation error when validation fails', async () => {
    const validationFunction = jest.fn().mockImplementation(() => false);
    const errMsg = faker.random.words();
    mockValidationErrorFactory.from.mockReturnValueOnce(
      new HttpException(errMsg, 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    expect(() =>
      genericValidator.validate(
        validationFunction as unknown as ValidateFunction,
        {},
      ),
    ).toThrow(errMsg);

    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});
