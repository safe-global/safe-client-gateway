import * as fs from 'fs';
import * as path from 'path';
import {
  PROJECT_ROOT,
  loadEnvJson,
  setFilePermissions,
} from './env-json-helpers';

const ENV_OUTPUT_PATH = path.join(PROJECT_ROOT, '.env');
const FORCE_MODE = process.argv.includes('--force');
const UPDATE_MODE = process.argv.includes('--update');

/**
 * Centralized messages for generate/update output
 */
const MESSAGES = {
  update: {
    noFileCreating: '🔧 .env file does not exist. Creating new .env file...\n',
    upToDate: '✅ Your .env file is already up to date!',
    success: '✅ Successfully updated .env file!',
    actionRequired: '⚠️  Action required:',
    reviewRequired: '   Review the new required variables at the end of .env',
    updateValues:
      '   Update them with actual values before running the application',
    optionalVarsTitle: '💡 Optional variables:',
    optionalCommented: '   Optional variables are commented out',
    uncommentToOverride:
      '   Uncomment and modify if you want to override defaults',
  },
  generate: {
    fileExists: '❌ Error: .env file already exists',
    success: '✅ Successfully generated .env file!',
  },
  common: {
    nextSteps: '⚠️  Next steps:',
    step1: '   1. Review the generated .env file',
    step2: '   2. Update all required variables with actual values',
    step3: '   3. Uncomment and modify optional variables as needed',
  },
  error: {
    generic: (message: string): string => `❌ Error: ${message}`,
  },
  headers: {
    missingRequired: (timestamp: string): string =>
      `# MISSING REQUIRED VARIABLES - Added by env:update on ${timestamp}`,
    missingOptional: (timestamp: string): string =>
      `# MISSING OPTIONAL VARIABLES - Added by env:update on ${timestamp}`,
    uncommentNote:
      '# Uncomment and modify these variables if you want to override the defaults',
    default: (value: string): string => `# Default: ${value}`,
  },
};

/**
 * Sanitize a string value by removing control characters and ensuring it's a string type.
 *
 * @param value - The value to sanitize
 *
 * @returns Sanitized string with control characters removed
 */
function sanitizeEnvValue(value: unknown): string {
  const strValue = String(value);

  // eslint-disable-next-line no-control-regex
  return strValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Parse existing .env file and extract variable names (both active and commented).
 * This detects both uncommented variables (VARIABLE=value) and commented ones (# VARIABLE=value)
 * to prevent duplicate additions when variables already exist as comments.
 *
 * @returns Map of variable names to their current values (commented vars have empty string value)
 */
export function parseExistingEnv(): Map<string, string> {
  const envMap = new Map<string, string>();

  if (!fs.existsSync(ENV_OUTPUT_PATH)) {
    return envMap;
  }

  const content = fs.readFileSync(ENV_OUTPUT_PATH, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.length > 10000) {
      continue;
    }

    const activeVarMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (activeVarMatch) {
      const [, name, value] = activeVarMatch;
      if (/^[A-Z_][A-Z0-9_]*$/.test(name)) {
        const safeValue = sanitizeEnvValue(value);
        envMap.set(String(name), safeValue);
      }
      continue;
    }

    const commentedVarMatch = trimmed.match(/^#\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (commentedVarMatch) {
      const [, name] = commentedVarMatch;
      // Validate name pattern and mark as existing but with empty value
      if (/^[A-Z_][A-Z0-9_]*$/.test(name) && !envMap.has(name)) {
        const safeName = String(name); // Explicit cast for safety
        envMap.set(safeName, '');
      }
    }
  }

  return envMap;
}

/**
 * Generate or update .env file with variables from .env.sample.json.
 * - If .env doesn't exist: creates it with all required variables
 * - If .env exists: appends only missing variables (preserves all existing values)
 * Optional variables with defaults are added as comments.
 *
 * @returns void - Exits process with code 0 on success, 1 on failure
 */
export function updateEnvFile(): void {
  const envExists = fs.existsSync(ENV_OUTPUT_PATH);

  if (!envExists) {
    console.log(MESSAGES.update.noFileCreating);
    generateNewEnvFile();

    return;
  }

  const existingVars = parseExistingEnv();
  const envVars = loadEnvJson();

  const missingRequired = envVars.filter(
    (v) => v.required && !existingVars.has(v.name),
  );
  const missingOptional = envVars.filter(
    (v) => !v.required && !existingVars.has(v.name) && v.defaultValue !== null,
  );

  if (missingRequired.length === 0 && missingOptional.length === 0) {
    console.log(MESSAGES.update.upToDate);
    process.exit(0);
  }

  const linesToAdd: Array<string> = [];

  if (missingRequired.length > 0) {
    linesToAdd.push('');
    linesToAdd.push(
      '# ==============================================================================',
    );
    linesToAdd.push(MESSAGES.headers.missingRequired(new Date().toISOString()));
    linesToAdd.push(
      '# ==============================================================================',
    );
    linesToAdd.push('');

    for (const envVar of missingRequired) {
      linesToAdd.push(`# ${envVar.description}`);
      if (envVar.defaultValue !== null) {
        linesToAdd.push(`${envVar.name}=${envVar.defaultValue}`);
      } else {
        linesToAdd.push(`${envVar.name}=`);
      }
      linesToAdd.push('');
    }
  }

  if (missingOptional.length > 0) {
    linesToAdd.push('');
    linesToAdd.push(
      '# ==============================================================================',
    );
    linesToAdd.push(MESSAGES.headers.missingOptional(new Date().toISOString()));
    linesToAdd.push(
      '# ==============================================================================',
    );
    linesToAdd.push(MESSAGES.headers.uncommentNote);
    linesToAdd.push(
      '# ==============================================================================',
    );
    linesToAdd.push('');

    for (const envVar of missingOptional) {
      linesToAdd.push(`# ${envVar.description}`);
      linesToAdd.push(MESSAGES.headers.default(envVar.defaultValue as string));
      linesToAdd.push(`# ${envVar.name}=${envVar.defaultValue}`);
      linesToAdd.push('');
    }
  }

  fs.appendFileSync(ENV_OUTPUT_PATH, linesToAdd.join('\n'), 'utf-8');
  setFilePermissions(ENV_OUTPUT_PATH, MESSAGES.error.generic);

  console.log(MESSAGES.update.success);
  console.log('');

  if (missingRequired.length > 0) {
    console.log(MESSAGES.update.actionRequired);
    console.log(MESSAGES.update.reviewRequired);
    console.log(MESSAGES.update.updateValues);
    console.log('');
  }

  if (missingOptional.length > 0) {
    console.log(MESSAGES.update.optionalVarsTitle);
    console.log(MESSAGES.update.optionalCommented);
    console.log(MESSAGES.update.uncommentToOverride);
    console.log('');
  }
}

/**
 * Generate a new .env file from required variables.
 * Internal helper function used by both generateEnvFile and updateEnvFile.
 * Creates .env file with all required variables and commented optional ones.
 *
 * @returns void
 */
export function generateNewEnvFile(): void {
  const envVars = loadEnvJson();
  const requiredVars = envVars.filter((v) => v.required);
  const optionalVarsWithDefaults = envVars.filter(
    (v) => !v.required && v.defaultValue !== null,
  );

  const lines: Array<string> = [];

  lines.push(
    '# ==============================================================================',
  );
  lines.push('# Safe Client Gateway Environment Variables');
  lines.push(
    '# ==============================================================================',
  );
  lines.push(
    '# This file was generated from .env.sample.json with required variables and defaults.',
  );
  lines.push(
    '# Please update the placeholder values with your actual configuration.',
  );
  lines.push(
    '# ==============================================================================',
  );
  lines.push('');

  if (requiredVars.length > 0) {
    lines.push(
      '# ==============================================================================',
    );
    lines.push('# REQUIRED VARIABLES');
    lines.push(
      '# ==============================================================================',
    );
    lines.push('');

    for (const envVar of requiredVars) {
      lines.push(`# ${envVar.description}`);
      if (envVar.defaultValue !== null) {
        lines.push(`${envVar.name}=${envVar.defaultValue}`);
      } else {
        lines.push(`${envVar.name}=`);
      }

      lines.push('');
    }
  }

  if (optionalVarsWithDefaults.length > 0) {
    lines.push(
      '# ==============================================================================',
    );
    lines.push('# OPTIONAL VARIABLES WITH DEFAULTS');
    lines.push(
      '# ==============================================================================',
    );
    lines.push(
      '# Uncomment and modify these variables if you want to override the defaults',
    );
    lines.push(
      '# ==============================================================================',
    );
    lines.push('');

    for (const envVar of optionalVarsWithDefaults) {
      lines.push(`# ${envVar.description}`);
      lines.push(MESSAGES.headers.default(envVar.defaultValue || ''));
      lines.push(`# ${envVar.name}=${envVar.defaultValue}`);

      lines.push('');
    }
  }

  fs.writeFileSync(ENV_OUTPUT_PATH, lines.join('\n'), 'utf-8');
  setFilePermissions(ENV_OUTPUT_PATH, MESSAGES.error.generic);

  console.log(MESSAGES.generate.success);
  console.log();
  console.log(MESSAGES.common.nextSteps);
  console.log(MESSAGES.common.step1);
  console.log(MESSAGES.common.step2);
  console.log(MESSAGES.common.step3);
  console.log();
}

/**
 * Generate .env file from required variables.
 * Creates a new .env file with all required variables and commented optional ones.
 * Fails if file already exists (unless FORCE_MODE).
 *
 * @returns void - Exits process with code 0 on success, 1 on failure
 */
export function generateEnvFile(): void {
  if (fs.existsSync(ENV_OUTPUT_PATH) && !FORCE_MODE) {
    console.error(MESSAGES.generate.fileExists);
    process.exit(1);
  }

  generateNewEnvFile();
}

/**
 * Main entry point.
 * Routes to appropriate function based on command-line flags.
 */
export function main(): void {
  if (UPDATE_MODE) {
    updateEnvFile();
  } else {
    generateEnvFile();
  }
}

if (process.env.NODE_ENV !== 'test') {
  try {
    main();
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(MESSAGES.error.generic(error.message));
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }

    console.error(MESSAGES.error.generic(String(error)));
    process.exit(1);
  }
}
