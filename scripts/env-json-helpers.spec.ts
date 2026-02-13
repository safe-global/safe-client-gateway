import * as fs from 'fs';
import * as path from 'path';
import {
  PROJECT_ROOT,
  EnvVariableSchema,
  EnvConfigSchema,
  loadEnvJson,
} from './env-json-helpers';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('env-json-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('EnvVariableSchema', () => {
    it('should validate a correct environment variable', () => {
      const validVar = {
        name: 'MY_VAR',
        description: 'Test variable',
        defaultValue: 'test',
        required: true,
      };

      const result = EnvVariableSchema.safeParse(validVar);
      expect(result.success).toBe(true);
    });

    it('should accept null defaultValue', () => {
      const validVar = {
        name: 'MY_VAR',
        description: 'Test variable',
        defaultValue: null,
        required: true,
      };

      const result = EnvVariableSchema.safeParse(validVar);
      expect(result.success).toBe(true);
    });

    it('should reject invalid variable name (lowercase)', () => {
      const invalidVar = {
        name: 'myVar',
        description: 'Test variable',
        defaultValue: 'test',
        required: true,
      };

      const result = EnvVariableSchema.safeParse(invalidVar);
      expect(result.success).toBe(false);
    });

    it('should reject invalid variable name (with spaces)', () => {
      const invalidVar = {
        name: 'MY VAR',
        description: 'Test variable',
        defaultValue: 'test',
        required: true,
      };

      const result = EnvVariableSchema.safeParse(invalidVar);
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const invalidVar = {
        name: 'MY_VAR',
        description: '',
        defaultValue: 'test',
        required: true,
      };

      const result = EnvVariableSchema.safeParse(invalidVar);
      expect(result.success).toBe(false);
    });

    it('should reject missing required field', () => {
      const invalidVar = {
        name: 'MY_VAR',
        description: 'Test variable',
        defaultValue: 'test',
      };

      const result = EnvVariableSchema.safeParse(invalidVar);
      expect(result.success).toBe(false);
    });
  });

  describe('EnvConfigSchema', () => {
    it('should validate array of environment variables', () => {
      const validConfig = [
        {
          name: 'VAR_1',
          description: 'First variable',
          defaultValue: 'value1',
          required: true,
        },
        {
          name: 'VAR_2',
          description: 'Second variable',
          defaultValue: null,
          required: false,
        },
      ];

      const result = EnvConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject non-array input', () => {
      const invalidConfig = {
        name: 'VAR_1',
        description: 'First variable',
        defaultValue: 'value1',
        required: true,
      };

      const result = EnvConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should accept empty array', () => {
      const result = EnvConfigSchema.safeParse([]);
      expect(result.success).toBe(true);
    });
  });

  describe('loadEnvJson', () => {
    const mockEnvJsonPath = path.join(PROJECT_ROOT, '.env.sample.json');

    it('should load and parse valid JSON file', () => {
      const mockData = [
        {
          name: 'TEST_VAR',
          description: 'Test variable',
          defaultValue: 'test',
          required: true,
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const result = loadEnvJson();

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockEnvJsonPath);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        mockEnvJsonPath,
        'utf-8',
      );
      expect(result).toEqual(mockData);
    });

    it('should exit with error if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit: ${code}`);
        });
      const mockConsoleError = jest
        .spyOn(console, 'error')
        .mockImplementation();

      expect(() => loadEnvJson()).toThrow('process.exit: 1');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error: .env.sample.json file not found',
      );

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should exit with error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json {');

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit: ${code}`);
        });
      const mockConsoleError = jest
        .spyOn(console, 'error')
        .mockImplementation();

      expect(() => loadEnvJson()).toThrow('process.exit: 1');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error: Invalid JSON in .env.sample.json',
      );

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should exit with error on invalid structure', () => {
      const invalidData = [
        {
          name: 'invalid_name', // lowercase not allowed
          description: 'Test',
          defaultValue: 'test',
          required: true,
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidData));

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit: ${code}`);
        });
      const mockConsoleError = jest
        .spyOn(console, 'error')
        .mockImplementation();

      expect(() => loadEnvJson()).toThrow('process.exit: 1');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error: Invalid structure in .env.sample.json',
      );

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should handle multiple valid variables', () => {
      const mockData = [
        {
          name: 'VAR_ONE',
          description: 'First variable',
          defaultValue: 'value1',
          required: true,
        },
        {
          name: 'VAR_TWO',
          description: 'Second variable',
          defaultValue: null,
          required: false,
        },
        {
          name: 'VAR_THREE',
          description: 'Third variable',
          defaultValue: '123',
          required: true,
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const result = loadEnvJson();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('VAR_ONE');
      expect(result[1].defaultValue).toBe(null);
      expect(result[2].required).toBe(true);
    });
  });
});
