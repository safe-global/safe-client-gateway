import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const ENV_JSON_PATH = path.join(PROJECT_ROOT, '.env.sample.json');
export const EnvVariableSchema = z.object({
  name: z
    .string()
    .regex(/^[A-Z_][A-Z0-9_]*$/, 'Must be uppercase with underscores'),
  description: z.string().min(1, 'Description is required'),
  defaultValue: z.union([z.number(), z.boolean(), z.string()]).nullable(),
  required: z.boolean(),
});
export const EnvConfigSchema = z.array(EnvVariableSchema);
export type EnvVariable = z.infer<typeof EnvVariableSchema>;

/**
 * Represents a directory entry with simple boolean properties.
 * Abstracts away Node.js fs.Dirent internal types for testability.
 */
export interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

/**
 * Read directory entries and return them as simplified DirectoryEntry objects.
 * Wraps fs.readdirSync with withFileTypes to provide a test-friendly interface.
 *
 * @param dir - The directory path to read
 * @returns Array of DirectoryEntry objects
 */
export function readDirectory(dir: string): Array<DirectoryEntry> {
  return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
    isFile: entry.isFile(),
  }));
}

/**
 * Check if a file path is a symbolic link.
 * Returns true if the path exists and is a symlink, false otherwise.
 *
 * @param filePath - Path to check
 *
 * @returns true if path is a symlink, false otherwise
 */
export function isSymbolicLink(filePath: string): boolean {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Set file permissions to 600 (read/write for owner only).
 * This is commonly used for sensitive files like .env to restrict access.
 * Exits with code 1 if the chmod operation fails.
 *
 * @param filePath - The file path to set permissions on
 * @param errorMessage - Function to format error messages for display
 *
 * @throws Exits process with code 1 on permission setting failure
 */
export function setFilePermissions(
  filePath: string,
  errorMessage: (message: string) => string,
): void {
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (error: unknown) {
    console.error(
      errorMessage(error instanceof Error ? error.message : 'UNKNOWN_ERROR'),
    );
    process.exit(1);
  }
}

/**
 * Sanitize a string value by removing control characters and ensuring it's a string type.
 * Removes all ASCII control characters (0-31, 127) except tab (\x09).
 * Crucially includes \n and \r to prevent .env line injection.
 *
 * @param value - The value to sanitize
 *
 * @returns Sanitized string with control characters removed
 */
export function sanitizeEnvValue(value: unknown): string {
  const strValue = String(value);

  // eslint-disable-next-line no-control-regex
  return strValue.replace(/[\x00-\x08\x0A-\x1F\x7F]/g, '');
}

/**
 * Escape newlines and carriage returns in .env comment text to prevent injection.
 * Replaces \n with literal space and \r with empty string.
 * This prevents malicious JSON from injecting new .env entries via description fields.
 *
 * @param text - The text to escape (description or defaultValue for comments)
 *
 * @returns Safe text with newlines removed
 */
function escapeEnvComment(text: string): string {
  return String(text)
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

/**
 * Format a required env variable as .env lines.
 * Returns description comment followed by an assignment line.
 *
 * @param envVar - The environment variable definition to format
 *
 * @returns Array of .env-formatted lines (includes trailing empty line)
 */
export function formatRequiredVar(envVar: EnvVariable): Array<string> {
  const lines: Array<string> = [];
  lines.push(`# ${escapeEnvComment(envVar.description)}`);

  if (envVar.defaultValue !== null) {
    lines.push(`${envVar.name}=${sanitizeEnvValue(envVar.defaultValue)}`);
  } else {
    lines.push(`${envVar.name}=`);
  }

  lines.push('');

  return lines;
}

/**
 * Format an optional env variable with default as commented .env lines.
 * Returns description comment, default value hint, and commented assignment.
 *
 * @param envVar - The environment variable definition to format (must have non-null defaultValue)
 *
 * @returns Array of .env-formatted comment lines (includes trailing empty line)
 */
export function formatOptionalVar(envVar: EnvVariable): Array<string> {
  const safeDefault = escapeEnvComment(String(envVar.defaultValue));
  return [
    `# ${escapeEnvComment(envVar.description)}`,
    `# Default: ${safeDefault}`,
    `# ${envVar.name}=${safeDefault}`,
    '',
  ];
}

/**
 * Find duplicate variable names in an array of environment variable definitions.
 * Returns an array of names that appear more than once.
 *
 * @param envVars - Array of environment variable definitions to check
 *
 * @returns Array of duplicate variable names (empty if no duplicates)
 */
export function findDuplicateNames(envVars: Array<EnvVariable>): Array<string> {
  const seen = new Set<string>();
  const duplicates: Array<string> = [];

  for (const envVar of envVars) {
    if (seen.has(envVar.name)) {
      duplicates.push(envVar.name);
    }
    seen.add(envVar.name);
  }

  return duplicates;
}

/**
 * Load and validate the .env.sample.json file.
 * Performs JSON parsing, Zod schema validation, and duplicate detection.
 * Exits with code 1 if file is missing, invalid JSON, invalid structure, or has duplicates.
 *
 * @returns Array of validated environment variable objects
 * @throws Exits process with code 1 on validation failure
 */
export function loadEnvJson(): Array<EnvVariable> {
  if (!fs.existsSync(ENV_JSON_PATH)) {
    console.error('❌ Error: .env.sample.json file not found');
    process.exit(1);
  }

  const content = fs.readFileSync(ENV_JSON_PATH, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error('❌ Error: Invalid JSON in .env.sample.json');
    console.error(error);
    process.exit(1);
  }

  const result = EnvConfigSchema.safeParse(parsed);

  if (!result.success) {
    console.error('❌ Error: Invalid structure in .env.sample.json');
    console.error(result.error);
    process.exit(1);
  }

  const duplicates = findDuplicateNames(result.data);

  if (duplicates.length > 0) {
    console.error('❌ Error: Duplicate variable names in .env.sample.json:');
    duplicates.forEach((name) => console.error(`   - ${name}`));
    console.error('');
    console.error('Each variable name must be unique.');
    process.exit(1);
  }

  return result.data;
}
