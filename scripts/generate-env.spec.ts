import * as fs from 'fs';
import * as path from 'path';
import {
  parseExistingEnv,
  updateEnvFile,
  generateNewEnvFile,
  generateEnvFile,
} from './generate-env';
import {
  loadEnvJson,
  PROJECT_ROOT,
  type EnvVariable,
} from './env-json-helpers';

jest.mock('fs');
jest.mock('./env-json-helpers');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockLoadEnvJson = loadEnvJson as jest.MockedFunction<typeof loadEnvJson>;

describe('generate-env', () => {
  const ENV_OUTPUT_PATH = path.join(PROJECT_ROOT, '.env');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(Date, 'now').mockReturnValue(1234567890000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseExistingEnv', () => {
    it('should return empty map when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = parseExistingEnv();

      expect(result.size).toBe(0);
      expect(mockFs.existsSync).toHaveBeenCalledWith(ENV_OUTPUT_PATH);
    });

    it('should parse active (uncommented) variables', () => {
      const mockContent = `
API_KEY=secret123
DATABASE_HOST=localhost
PORT=3000
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(3);
      expect(result.get('API_KEY')).toBe('secret123');
      expect(result.get('DATABASE_HOST')).toBe('localhost');
      expect(result.get('PORT')).toBe('3000');
    });

    it('should parse commented variables', () => {
      const mockContent = `
# OPTIONAL_VAR=default_value
# ANOTHER_OPTIONAL=test123
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(2);
      expect(result.has('OPTIONAL_VAR')).toBe(true);
      expect(result.has('ANOTHER_OPTIONAL')).toBe(true);
      expect(result.get('OPTIONAL_VAR')).toBe(''); // Commented vars have empty value
      expect(result.get('ANOTHER_OPTIONAL')).toBe('');
    });

    it('should handle mixed active and commented variables', () => {
      const mockContent = `
# Comment line
API_KEY=secret
# OPTIONAL_VAR=default
DATABASE_HOST=localhost
# ANOTHER_OPTIONAL=test
PORT=3000
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(5);
      expect(result.get('API_KEY')).toBe('secret');
      expect(result.get('DATABASE_HOST')).toBe('localhost');
      expect(result.get('PORT')).toBe('3000');
      expect(result.get('OPTIONAL_VAR')).toBe('');
      expect(result.get('ANOTHER_OPTIONAL')).toBe('');
    });

    it('should skip pure comment lines', () => {
      const mockContent = `
# This is a comment
# Another comment without variable
API_KEY=secret
# === Section Header ===
DATABASE_HOST=localhost
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(2);
      expect(result.has('API_KEY')).toBe(true);
      expect(result.has('DATABASE_HOST')).toBe(true);
    });

    it('should prioritize active variables over commented ones', () => {
      const mockContent = `
# API_KEY=commented_value
API_KEY=active_value
# DATABASE_HOST=commented
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(2);
      expect(result.get('API_KEY')).toBe('active_value');
      expect(result.get('DATABASE_HOST')).toBe('');
    });

    it('should handle empty lines and whitespace', () => {
      const mockContent = `

  
API_KEY=secret

DATABASE_HOST=localhost
  
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(2);
      expect(result.get('API_KEY')).toBe('secret');
      expect(result.get('DATABASE_HOST')).toBe('localhost');
    });

    it('should handle variables with special characters in values', () => {
      const mockContent = `
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=abc123!@#$%^&*()
EMPTY_VAR=
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(3);
      expect(result.get('DATABASE_URL')).toBe(
        'postgresql://user:pass@localhost:5432/db',
      );
      expect(result.get('JWT_SECRET')).toBe('abc123!@#$%^&*()');
      expect(result.get('EMPTY_VAR')).toBe('');
    });

    it('should sanitize control characters from values', () => {
      const mockContent = `
API_KEY=secret\x00\x01\x02value
DATABASE_HOST=local\x1Bhost
MALICIOUS=evil\x7Fcode
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(3);
      expect(result.get('API_KEY')).toBe('secretvalue');
      expect(result.get('DATABASE_HOST')).toBe('localhost');
      expect(result.get('MALICIOUS')).toBe('evilcode');
    });

    it('should cast variable names and values to string type', () => {
      const mockContent = `
VALID_VAR=normalValue
ANOTHER_VAR=123
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = parseExistingEnv();

      expect(result.size).toBe(2);
      expect(typeof result.get('VALID_VAR')).toBe('string');
      expect(typeof result.get('ANOTHER_VAR')).toBe('string');
      expect(result.get('ANOTHER_VAR')).toBe('123');
    });
  });

  describe('generateNewEnvFile', () => {
    it('should generate .env file with required and optional variables', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'REQUIRED_VAR',
          description: 'Required variable',
          defaultValue: null,
          required: true,
        },
        {
          name: 'REQUIRED_WITH_DEFAULT',
          description: 'Required with default',
          defaultValue: 'default123',
          required: true,
        },
        {
          name: 'OPTIONAL_VAR',
          description: 'Optional variable',
          defaultValue: 'optional123',
          required: false,
        },
        {
          name: 'OPTIONAL_NO_DEFAULT',
          description: 'Optional without default',
          defaultValue: null,
          required: false,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      let writtenContent = '';
      mockFs.writeFileSync.mockImplementation((_, content) => {
        writtenContent = content as string;
      });

      generateNewEnvFile();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        ENV_OUTPUT_PATH,
        expect.any(String),
        'utf-8',
      );
      expect(writtenContent).toContain('REQUIRED_VAR=');
      expect(writtenContent).toContain('REQUIRED_WITH_DEFAULT=default123');
      expect(writtenContent).toContain('# OPTIONAL_VAR=optional123');
      expect(writtenContent).not.toContain('OPTIONAL_NO_DEFAULT');
    });

    it('should include proper headers and sections', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'API_KEY',
          description: 'API Key',
          defaultValue: null,
          required: true,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      let writtenContent = '';
      mockFs.writeFileSync.mockImplementation((path, content) => {
        writtenContent = content as string;
      });

      generateNewEnvFile();

      expect(writtenContent).toContain(
        'Safe Client Gateway Environment Variables',
      );
      expect(writtenContent).toContain('REQUIRED VARIABLES');
      expect(writtenContent).toContain('# API Key');
    });

    it('should handle only required variables', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'VAR_1',
          description: 'Variable 1',
          defaultValue: null,
          required: true,
        },
        {
          name: 'VAR_2',
          description: 'Variable 2',
          defaultValue: 'default',
          required: true,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      let writtenContent = '';
      mockFs.writeFileSync.mockImplementation((_, content) => {
        writtenContent = content as string;
      });

      generateNewEnvFile();

      expect(writtenContent).toContain('VAR_1=');
      expect(writtenContent).toContain('VAR_2=default');
      expect(writtenContent).not.toContain('OPTIONAL VARIABLES');
    });

    it('should handle only optional variables with defaults', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'OPT_1',
          description: 'Optional 1',
          defaultValue: 'default1',
          required: false,
        },
        {
          name: 'OPT_2',
          description: 'Optional 2',
          defaultValue: 'default2',
          required: false,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      let writtenContent = '';
      mockFs.writeFileSync.mockImplementation((path, content) => {
        writtenContent = content as string;
      });

      generateNewEnvFile();

      expect(writtenContent).toContain('# OPT_1=default1');
      expect(writtenContent).toContain('# OPT_2=default2');
      expect(writtenContent).toContain('OPTIONAL VARIABLES WITH DEFAULTS');
    });
  });

  describe('generateEnvFile', () => {
    it('should fail if .env exists without force mode', () => {
      mockFs.existsSync.mockReturnValue(true);
      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit: ${code}`);
        });
      const mockConsoleError = jest
        .spyOn(console, 'error')
        .mockImplementation();

      expect(() => generateEnvFile()).toThrow('process.exit: 1');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('.env file already exists'),
      );

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should create .env file if it does not exist', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'TEST_VAR',
          description: 'Test variable',
          defaultValue: null,
          required: true,
        },
      ];

      mockFs.existsSync.mockReturnValue(false);
      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      mockFs.writeFileSync.mockImplementation();

      generateEnvFile();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        ENV_OUTPUT_PATH,
        expect.stringContaining('TEST_VAR='),
        'utf-8',
      );
    });
  });

  describe('updateEnvFile', () => {
    it('should create new file if it does not exist', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'TEST_VAR',
          description: 'Test',
          defaultValue: null,
          required: true,
        },
      ];

      mockFs.existsSync.mockReturnValue(false);
      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      mockFs.writeFileSync.mockImplementation();

      updateEnvFile();

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should detect when file is up to date', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'EXISTING_VAR',
          description: 'Existing',
          defaultValue: null,
          required: true,
        },
        {
          name: 'OPTIONAL_VAR',
          description: 'Optional',
          defaultValue: 'default',
          required: false,
        },
      ];

      const mockContent = `
EXISTING_VAR=value
# OPTIONAL_VAR=default
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);
      mockLoadEnvJson.mockReturnValue(mockEnvVars);

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit: ${code}`);
        });

      expect(() => updateEnvFile()).toThrow('process.exit: 0');

      mockExit.mockRestore();
    });

    it('should add missing required variables', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'EXISTING_VAR',
          description: 'Existing',
          defaultValue: null,
          required: true,
        },
        {
          name: 'NEW_REQUIRED_VAR',
          description: 'New required',
          defaultValue: null,
          required: true,
        },
      ];

      const mockContent = 'EXISTING_VAR=value';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);
      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      let appendedContent = '';
      mockFs.appendFileSync.mockImplementation((path, content) => {
        appendedContent = content as string;
      });

      updateEnvFile();

      expect(mockFs.appendFileSync).toHaveBeenCalled();
      expect(appendedContent).toContain('NEW_REQUIRED_VAR=');
      expect(appendedContent).toContain('MISSING REQUIRED VARIABLES');
    });

    it('should add missing optional variables as comments', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'EXISTING_VAR',
          description: 'Existing',
          defaultValue: null,
          required: true,
        },
        {
          name: 'NEW_OPTIONAL_VAR',
          description: 'New optional',
          defaultValue: 'default123',
          required: false,
        },
      ];

      const mockContent = 'EXISTING_VAR=value';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);
      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      let appendedContent = '';
      mockFs.appendFileSync.mockImplementation((_, content) => {
        appendedContent = content as string;
      });

      updateEnvFile();

      expect(mockFs.appendFileSync).toHaveBeenCalled();
      expect(appendedContent).toContain('# NEW_OPTIONAL_VAR=default123');
      expect(appendedContent).toContain('MISSING OPTIONAL VARIABLES');
    });

    it('should not duplicate already existing commented variables', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'ACTIVE_VAR',
          description: 'Active',
          defaultValue: null,
          required: true,
        },
        {
          name: 'COMMENTED_VAR',
          description: 'Commented',
          defaultValue: 'default',
          required: false,
        },
      ];

      const mockContent = `
ACTIVE_VAR=value
# COMMENTED_VAR=default
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);
      mockLoadEnvJson.mockReturnValue(mockEnvVars);

      const mockExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit: ${code}`);
        });

      expect(() => updateEnvFile()).toThrow('process.exit: 0');
      expect(mockFs.appendFileSync).not.toHaveBeenCalled();

      mockExit.mockRestore();
    });
  });
});
