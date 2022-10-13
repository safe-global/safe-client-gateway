import { backboneSchema } from '../balances/entities/schemas/backbone.schema';
import backboneFactory from '../balances/entities/__tests__/backbone.factory';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { BackboneValidator } from './backbone.validator';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Backbone validator', () => {
  const validator = new BackboneValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(backboneSchema);
  });

  it('should return the data when validation succeed', () => {
    const backbone = backboneFactory();
    mockGenericValidator.validate.mockReturnValue(backbone);

    const result = validator.validate(backbone);

    expect(result).toBe(backbone);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
