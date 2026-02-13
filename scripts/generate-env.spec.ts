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
  isSymbolicLink,
  type EnvVariable,
} from './env-json-helpers';
import {
  mockProcessExit,
  captureWriteContent,
  captureAppendContent,
} from './test-utils';

jest.mock('fs');
jest.mock('./env-json-helpers', () => ({
  ...jest.requireActual('./env-json-helpers'),
  loadEnvJson: jest.fn(),
  isSymbolicLink: jest.fn(),
  setFilePermissions: jest.fn(),
}));

const mockFs = jest.mocked(fs);
const mockLoadEnvJson = jest.mocked(loadEnvJson);
const mockIsSymbolicLink = jest.mocked(isSymbolicLink);

describe('generate-env', () => {
  const ENV_OUTPUT_PATH = path.join(PROJECT_ROOT, '.env');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(Date, 'now').mockReturnValue(1234567890000);
    mockIsSymbolicLink.mockReturnValue(false);
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

  describe('security: content injection prevention', () => {
    it('should escape newlines in description fields to prevent injection', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'MALICIOUS_VAR',
          description: 'Safe description\nINJECTED_VAR=malicious_value',
          defaultValue: 'safe-value',
          required: true,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      mockFs.existsSync.mockReturnValue(false);
      const written = captureWriteContent(mockFs.writeFileSync);

      generateNewEnvFile();

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(written.content).toContain(
        'Safe description INJECTED_VAR=malicious_value',
      );
      expect(
        written.content
          .split('\n')
          .filter((line) => line.trim() === 'INJECTED_VAR=malicious_value'),
      ).toHaveLength(0);
    });

    it('should escape newlines in defaultValue fields in comments', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'OPTIONAL_VAR',
          description: 'Optional variable',
          defaultValue: 'default\nSECRET_KEY=injected',
          required: false,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      mockFs.existsSync.mockReturnValue(false);
      const written = captureWriteContent(mockFs.writeFileSync);

      generateNewEnvFile();

      expect(written.content).toContain('default SECRET_KEY=injected');
      expect(
        written.content
          .split('\n')
          .filter((line) => line.trim() === 'SECRET_KEY=injected'),
      ).toHaveLength(0);
    });

    it('should strip CR/LF from required defaults in actual assignments', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'REQUIRED_VAR',
          description: 'Required variable',
          defaultValue: 'value\nINJECTED=evil',
          required: true,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      mockFs.existsSync.mockReturnValue(false);
      const written = captureWriteContent(mockFs.writeFileSync);

      generateNewEnvFile();

      expect(written.content).toContain('REQUIRED_VAR=valueINJECTED=evil');
      const activeLines = written.content
        .split('\n')
        .filter((line) => !line.startsWith('#') && line.trim() !== '');
      expect(
        activeLines.filter((line) => line.trim() === 'INJECTED=evil'),
      ).toHaveLength(0);
    });

    it('should escape newlines in optional defaults in update mode comment line', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'EXISTING_VAR',
          description: 'Existing',
          defaultValue: null,
          required: true,
        },
        {
          name: 'NEW_OPTIONAL',
          description: 'New optional',
          defaultValue: 'default\nHIJACK=evil',
          required: false,
        },
      ];

      const mockContent = 'EXISTING_VAR=value';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);
      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      const appended = captureAppendContent(mockFs.appendFileSync);

      updateEnvFile();

      expect(appended.content).toContain('# NEW_OPTIONAL=default HIJACK=evil');
      const activeLines = appended.content
        .split('\n')
        .filter((line) => !line.startsWith('#') && line.trim() !== '');
      expect(
        activeLines.filter((line) => line.trim() === 'HIJACK=evil'),
      ).toHaveLength(0);
    });
  });

  describe('security: symlink protection', () => {
    it('should exit with error when .env is a symlink (updateEnvFile)', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'NEW_VAR',
          description: 'New',
          defaultValue: null,
          required: true,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('EXISTING_VAR=value\n');
      mockIsSymbolicLink.mockReturnValue(true);

      const exitSpy = mockProcessExit();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => updateEnvFile()).toThrow('process.exit: 1');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('symbolic link'),
      );

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should exit with error when .env is a symlink (generateNewEnvFile)', () => {
      const mockEnvVars: Array<EnvVariable> = [
        {
          name: 'VAR',
          description: 'Test',
          defaultValue: null,
          required: true,
        },
      ];

      mockLoadEnvJson.mockReturnValue(mockEnvVars);
      mockFs.existsSync.mockReturnValue(false);
      mockIsSymbolicLink.mockReturnValue(true);

      const exitSpy = mockProcessExit();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => generateNewEnvFile()).toThrow('process.exit: 1');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('symbolic link'),
      );

      exitSpy.mockRestore();
      errorSpy.mockRestore();
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
      const written = captureWriteContent(mockFs.writeFileSync);

      generateNewEnvFile();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        ENV_OUTPUT_PATH,
        expect.any(String),
        'utf-8',
      );
      expect(written.content).toContain('REQUIRED_VAR=');
      expect(written.content).toContain('REQUIRED_WITH_DEFAULT=default123');
      expect(written.content).toContain('# OPTIONAL_VAR=optional123');
      expect(written.content).not.toContain('OPTIONAL_NO_DEFAULT');
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
      const written = captureWriteContent(mockFs.writeFileSync);

      generateNewEnvFile();

      expect(written.content).toContain(
        'Safe Client Gateway Environment Variables',
      );
      expect(written.content).toContain('REQUIRED VARIABLES');
      expect(written.content).toContain('# API Key');
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
      const written = captureWriteContent(mockFs.writeFileSync);

      generateNewEnvFile();

      expect(written.content).toContain('VAR_1=');
      expect(written.content).toContain('VAR_2=default');
      expect(written.content).not.toContain('OPTIONAL VARIABLES');
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
      const written = captureWriteContent(mockFs.writeFileSync);

      generateNewEnvFile();

      expect(written.content).toContain('# OPT_1=default1');
      expect(written.content).toContain('# OPT_2=default2');
      expect(written.content).toContain('OPTIONAL VARIABLES WITH DEFAULTS');
    });
  });

  describe('generateEnvFile', () => {
    it('should fail if .env exists without force mode', () => {
      mockFs.existsSync.mockReturnValue(true);

      const exitSpy = mockProcessExit();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => generateEnvFile()).toThrow('process.exit: 1');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('.env file already exists'),
      );

      exitSpy.mockRestore();
      errorSpy.mockRestore();
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

      const exitSpy = mockProcessExit();

      expect(() => updateEnvFile()).toThrow('process.exit: 0');

      exitSpy.mockRestore();
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
      const appended = captureAppendContent(mockFs.appendFileSync);

      updateEnvFile();

      expect(mockFs.appendFileSync).toHaveBeenCalled();
      expect(appended.content).toContain('NEW_REQUIRED_VAR=');
      expect(appended.content).toContain('MISSING REQUIRED VARIABLES');
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
      const appended = captureAppendContent(mockFs.appendFileSync);

      updateEnvFile();

      expect(mockFs.appendFileSync).toHaveBeenCalled();
      expect(appended.content).toContain('# NEW_OPTIONAL_VAR=default123');
      expect(appended.content).toContain('MISSING OPTIONAL VARIABLES');
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

      const exitSpy = mockProcessExit();

      expect(() => updateEnvFile()).toThrow('process.exit: 0');
      expect(mockFs.appendFileSync).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });
});
