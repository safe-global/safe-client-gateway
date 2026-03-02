import * as fs from 'fs';
import * as path from 'path';
import {
  PROJECT_ROOT,
  EnvVariableSchema,
  EnvConfigSchema,
  loadEnvJson,
  isSymbolicLink,
  sanitizeEnvValue,
  formatRequiredVar,
  formatOptionalVar,
  findDuplicateNames,
  type EnvVariable,
} from './env-json-helpers';
import { createMockStats, mockProcessExit } from './test-utils';

// Mock fs module
jest.mock('fs');
const mockFs = jest.mocked(fs);

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
      const exitSpy = mockProcessExit();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => loadEnvJson()).toThrow('process.exit: 1');
      expect(errorSpy).toHaveBeenCalledWith(
        '❌ Error: .env.sample.json file not found',
      );

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should exit with error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json {');

      const exitSpy = mockProcessExit();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => loadEnvJson()).toThrow('process.exit: 1');
      expect(errorSpy).toHaveBeenCalledWith(
        '❌ Error: Invalid JSON in .env.sample.json',
      );

      exitSpy.mockRestore();
      errorSpy.mockRestore();
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

      const exitSpy = mockProcessExit();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => loadEnvJson()).toThrow('process.exit: 1');
      expect(errorSpy).toHaveBeenCalledWith(
        '❌ Error: Invalid structure in .env.sample.json',
      );

      exitSpy.mockRestore();
      errorSpy.mockRestore();
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

    it('should exit with error on duplicate variable names', () => {
      const mockData = [
        {
          name: 'DUPLICATE_VAR',
          description: 'First occurrence',
          defaultValue: 'value1',
          required: true,
        },
        {
          name: 'UNIQUE_VAR',
          description: 'Unique variable',
          defaultValue: null,
          required: false,
        },
        {
          name: 'DUPLICATE_VAR',
          description: 'Second occurrence',
          defaultValue: 'value2',
          required: true,
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const exitSpy = mockProcessExit();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => loadEnvJson()).toThrow('process.exit: 1');
      expect(errorSpy).toHaveBeenCalledWith(
        '❌ Error: Duplicate variable names in .env.sample.json:',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DUPLICATE_VAR'),
      );

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('isSymbolicLink', () => {
    it('should return true for symbolic links', () => {
      mockFs.lstatSync.mockReturnValue(createMockStats(true));

      const result = isSymbolicLink('/path/to/symlink');

      expect(result).toBe(true);
      expect(mockFs.lstatSync).toHaveBeenCalledWith('/path/to/symlink');
    });

    it('should return false for regular files', () => {
      mockFs.lstatSync.mockReturnValue(createMockStats(false));

      const result = isSymbolicLink('/path/to/regular-file');

      expect(result).toBe(false);
    });

    it('should return false when file does not exist', () => {
      mockFs.lstatSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      const result = isSymbolicLink('/path/to/nonexistent');

      expect(result).toBe(false);
    });

    it('should return false on permission errors', () => {
      mockFs.lstatSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = isSymbolicLink('/path/to/restricted');

      expect(result).toBe(false);
    });
  });

  describe('sanitizeEnvValue', () => {
    it('should remove control characters', () => {
      expect(sanitizeEnvValue('hello\x00\x01\x02world')).toBe('helloworld');
    });

    it('should strip newlines and carriage returns', () => {
      expect(sanitizeEnvValue('line1\nline2\rline3')).toBe('line1line2line3');
    });

    it('should preserve tabs', () => {
      expect(sanitizeEnvValue('before\tafter')).toBe('before\tafter');
    });

    it('should cast non-string values to string', () => {
      expect(sanitizeEnvValue(123)).toBe('123');
      expect(sanitizeEnvValue(true)).toBe('true');
      expect(sanitizeEnvValue(null)).toBe('null');
    });
  });

  describe('formatRequiredVar', () => {
    it('should format a required var with default value', () => {
      const envVar: EnvVariable = {
        name: 'API_KEY',
        description: 'The API key',
        defaultValue: 'secret',
        required: true,
      };

      const lines = formatRequiredVar(envVar);

      expect(lines).toEqual(['# The API key', 'API_KEY=secret', '']);
    });

    it('should format a required var without default value', () => {
      const envVar: EnvVariable = {
        name: 'DB_HOST',
        description: 'Database host',
        defaultValue: null,
        required: true,
      };

      const lines = formatRequiredVar(envVar);

      expect(lines).toEqual(['# Database host', 'DB_HOST=', '']);
    });

    it('should escape newlines in description', () => {
      const envVar: EnvVariable = {
        name: 'VAR',
        description: 'Line one\nLine two',
        defaultValue: null,
        required: true,
      };

      const lines = formatRequiredVar(envVar);

      expect(lines[0]).toBe('# Line one Line two');
    });

    it('should sanitize control characters in default value', () => {
      const envVar: EnvVariable = {
        name: 'VAR',
        description: 'Variable',
        defaultValue: 'val\nINJECTED=evil',
        required: true,
      };

      const lines = formatRequiredVar(envVar);

      expect(lines[1]).toBe('VAR=valINJECTED=evil');
    });
  });

  describe('formatOptionalVar', () => {
    it('should format an optional var as commented lines', () => {
      const envVar: EnvVariable = {
        name: 'OPT_VAR',
        description: 'Optional variable',
        defaultValue: 'default123',
        required: false,
      };

      const lines = formatOptionalVar(envVar);

      expect(lines).toEqual([
        '# Optional variable',
        '# Default: default123',
        '# OPT_VAR=default123',
        '',
      ]);
    });

    it('should escape newlines in default value', () => {
      const envVar: EnvVariable = {
        name: 'OPT',
        description: 'Optional',
        defaultValue: 'val\nINJECTED=evil',
        required: false,
      };

      const lines = formatOptionalVar(envVar);

      expect(lines[1]).toBe('# Default: val INJECTED=evil');
      expect(lines[2]).toBe('# OPT=val INJECTED=evil');
    });
  });

  describe('findDuplicateNames', () => {
    it('should return empty array when no duplicates', () => {
      const envVars: Array<EnvVariable> = [
        {
          name: 'VAR_A',
          description: 'A',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_B',
          description: 'B',
          defaultValue: null,
          required: true,
        },
      ];

      expect(findDuplicateNames(envVars)).toEqual([]);
    });

    it('should detect single duplicate', () => {
      const envVars: Array<EnvVariable> = [
        {
          name: 'DUP',
          description: 'First',
          defaultValue: null,
          required: true,
        },
        {
          name: 'UNIQUE',
          description: 'Unique',
          defaultValue: null,
          required: true,
        },
        {
          name: 'DUP',
          description: 'Second',
          defaultValue: null,
          required: true,
        },
      ];

      expect(findDuplicateNames(envVars)).toEqual(['DUP']);
    });

    it('should detect multiple duplicates', () => {
      const envVars: Array<EnvVariable> = [
        {
          name: 'A',
          description: 'A1',
          defaultValue: null,
          required: true,
        },
        {
          name: 'B',
          description: 'B1',
          defaultValue: null,
          required: true,
        },
        {
          name: 'A',
          description: 'A2',
          defaultValue: null,
          required: true,
        },
        {
          name: 'B',
          description: 'B2',
          defaultValue: null,
          required: true,
        },
      ];

      expect(findDuplicateNames(envVars)).toEqual(['A', 'B']);
    });

    it('should return empty array for empty input', () => {
      expect(findDuplicateNames([])).toEqual([]);
    });
  });
});
