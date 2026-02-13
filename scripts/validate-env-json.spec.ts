import * as fs from 'fs';
import * as path from 'path';
import {
  findTsFiles,
  extractProcessEnvVariables,
  checkDuplicates,
} from './validate-env-json';
import {
  readDirectory,
  PROJECT_ROOT,
  type EnvVariable,
  type DirectoryEntry,
} from './env-json-helpers';

jest.mock('fs');
jest.mock('./env-json-helpers');

const mockFs = jest.mocked(fs);
const mockReadDirectory = jest.mocked(readDirectory);

/**
 * Helper to create a DirectoryEntry representing a file
 */
function fileEntry(name: string): DirectoryEntry {
  return { name, isDirectory: false, isFile: true };
}

/**
 * Helper to create a DirectoryEntry representing a directory
 */
function dirEntry(name: string): DirectoryEntry {
  return { name, isDirectory: true, isFile: false };
}

describe('validate-env-json', () => {
  const SRC_PATH = path.join(PROJECT_ROOT, 'src');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findTsFiles', () => {
    it('should find TypeScript files recursively', () => {
      mockReadDirectory
        .mockReturnValueOnce([
          fileEntry('file1.ts'),
          dirEntry('subdir'),
          fileEntry('file2.spec.ts'),
        ])
        .mockReturnValueOnce([fileEntry('nested.ts')]);

      const result = findTsFiles(SRC_PATH);

      expect(result).toContain(path.join(SRC_PATH, 'file1.ts'));
      expect(result).toContain(path.join(SRC_PATH, 'subdir', 'nested.ts'));
      expect(result).not.toContain(path.join(SRC_PATH, 'file2.spec.ts'));
    });

    it('should skip node_modules directory', () => {
      mockReadDirectory.mockReturnValueOnce([
        dirEntry('node_modules'),
        fileEntry('src.ts'),
      ]);

      const result = findTsFiles(SRC_PATH);

      expect(result).toContain(path.join(SRC_PATH, 'src.ts'));
      expect(result).toHaveLength(1);
      expect(mockReadDirectory).toHaveBeenCalledTimes(1);
    });

    it('should exclude .spec.ts files', () => {
      mockReadDirectory.mockReturnValueOnce([
        fileEntry('test.spec.ts'),
        fileEntry('impl.ts'),
      ]);

      const result = findTsFiles(SRC_PATH);

      expect(result).not.toContain(path.join(SRC_PATH, 'test.spec.ts'));
      expect(result).toContain(path.join(SRC_PATH, 'impl.ts'));
    });
  });

  describe('extractProcessEnvVariables', () => {
    beforeEach(() => {
      mockReadDirectory.mockReturnValue([fileEntry('config.ts')]);
    });

    it('should extract environment variables from code', () => {
      const mockCode = `
        export const config = {
          apiKey: process.env.API_KEY,
          dbHost: process.env.DATABASE_HOST,
          port: process.env.PORT || 3000,
        };
      `;

      mockFs.readFileSync.mockReturnValue(mockCode);

      const result = extractProcessEnvVariables();

      expect(result).toContain('API_KEY');
      expect(result).toContain('DATABASE_HOST');
      expect(result).toContain('PORT');
      expect(result.size).toBe(3);
    });

    it('should handle duplicate variable occurrences', () => {
      const mockCode = `
        const key1 = process.env.API_KEY;
        const key2 = process.env.API_KEY;
        const key3 = process.env.OTHER_KEY;
      `;

      mockFs.readFileSync.mockReturnValue(mockCode);

      const result = extractProcessEnvVariables();

      expect(result).toContain('API_KEY');
      expect(result).toContain('OTHER_KEY');
      expect(result.size).toBe(2);
    });

    it('should ignore lowercase variables', () => {
      const mockCode = `
        const config = {
          valid: process.env.VALID_VAR,
          invalid: process.env.invalidVar,
        };
      `;

      mockFs.readFileSync.mockReturnValue(mockCode);

      const result = extractProcessEnvVariables();

      expect(result).toContain('VALID_VAR');
      expect(result).not.toContain('invalidVar');
      expect(result.size).toBe(1);
    });

    it('should filter out ignored variables', () => {
      const mockCode = `
        const config = {
          nodeEnv: process.env.NODE_ENV,
          ci: process.env.CI,
          custom: process.env.CUSTOM_VAR,
        };
      `;

      mockFs.readFileSync.mockReturnValue(mockCode);

      const result = extractProcessEnvVariables();

      expect(result).not.toContain('NODE_ENV');
      expect(result).not.toContain('CI');
      expect(result).toContain('CUSTOM_VAR');
    });

    it('should handle empty files', () => {
      mockFs.readFileSync.mockReturnValue('');

      const result = extractProcessEnvVariables();

      expect(result.size).toBe(0);
    });
  });

  describe('checkDuplicates', () => {
    it('should detect duplicate variable names', () => {
      const envVars: Array<EnvVariable> = [
        {
          name: 'VAR_1',
          description: 'First occurrence',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_2',
          description: 'Unique variable',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_1',
          description: 'Duplicate occurrence',
          defaultValue: null,
          required: true,
        },
      ];

      const mockConsoleError = jest
        .spyOn(console, 'error')
        .mockImplementation();

      const result = checkDuplicates(envVars);

      expect(result).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate variables'),
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('VAR_1'),
      );

      mockConsoleError.mockRestore();
    });

    it('should return true when no duplicates exist', () => {
      const envVars: Array<EnvVariable> = [
        {
          name: 'VAR_1',
          description: 'First variable',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_2',
          description: 'Second variable',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_3',
          description: 'Third variable',
          defaultValue: null,
          required: false,
        },
      ];

      const result = checkDuplicates(envVars);

      expect(result).toBe(true);
    });

    it('should handle empty array', () => {
      const result = checkDuplicates([]);

      expect(result).toBe(true);
    });

    it('should handle single variable', () => {
      const envVars: Array<EnvVariable> = [
        {
          name: 'SINGLE_VAR',
          description: 'Only one',
          defaultValue: null,
          required: true,
        },
      ];

      const result = checkDuplicates(envVars);

      expect(result).toBe(true);
    });

    it('should detect multiple duplicates', () => {
      const envVars: Array<EnvVariable> = [
        {
          name: 'VAR_A',
          description: 'A1',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_B',
          description: 'B1',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_A',
          description: 'A2',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_C',
          description: 'C1',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_B',
          description: 'B2',
          defaultValue: null,
          required: true,
        },
      ];

      const mockConsoleError = jest
        .spyOn(console, 'error')
        .mockImplementation();

      const result = checkDuplicates(envVars);

      expect(result).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('VAR_A'),
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('VAR_B'),
      );

      mockConsoleError.mockRestore();
    });
  });
});
