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
  defaultValue: z.string().nullable(),
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
 * Load and validate the .env.sample.json file.
 * Performs JSON parsing and Zod schema validation.
 * Exits with code 1 if file is missing, invalid JSON, or invalid structure.
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

  return result.data;
}

/**
 * Set file permissions to 600 (read/write for owner only).
 * This is commonly used for sensitive files like .env to restrict access.
 * Exits with code 1 if the chmod operation fails.
 *
 * @param path - The file path to set permissions on
 * @param errorMessage - Function to format error messages for display
 *
 * @returns void - Exits process with code 0 on success, 1 on failure
 *
 * @throws Exits process with code 1 on permission setting failure
 */
export function setFilePermissions(
  path: string,
  errorMessage: (message: string) => string,
): void {
  try {
    fs.chmodSync(path, 0o600);
  } catch (error: unknown) {
    console.error(
      errorMessage(error instanceof Error ? error.message : 'UNKNOWN_ERROR'),
    );
    process.exit(1);
  }
}
