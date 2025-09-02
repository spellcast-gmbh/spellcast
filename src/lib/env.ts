/**
 * Centralized environment configuration
 * All environment variables should be accessed through this module
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }
  
  return value;
}

function getOptionalEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

function getBooleanEnvVar(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

function getNumberEnvVar(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  
  return parsed;
}

// Application Configuration
export const env = {
  // Server Configuration
  NODE_ENV: getOptionalEnvVar('NODE_ENV', 'development'),
  PORT: getNumberEnvVar('PORT', 3000),
  
  // API Authentication
  API_KEY: getEnvVar('API_KEY'),
  
  // Linear Configuration
  LINEAR_API_KEY: getOptionalEnvVar('LINEAR_API_KEY'),
  DEFAULT_PROJECT_ID: getOptionalEnvVar('DEFAULT_PROJECT_ID'),
  
  // Firebase Configuration
  FIREBASE_SERVICE_ACCOUNT: getEnvVar('FIREBASE_SERVICE_ACCOUNT'),
  FIREBASE_DATABASE_URL: getOptionalEnvVar('FIREBASE_DATABASE_URL'),
  
  // Server URLs
  BASE_URL: getOptionalEnvVar('BASE_URL', 'http://localhost:3000'),
  
  // Development/Testing
  IS_DEVELOPMENT: getOptionalEnvVar('NODE_ENV', 'development') === 'development',
  IS_PRODUCTION: getOptionalEnvVar('NODE_ENV', 'development') === 'production',
  IS_TEST: getOptionalEnvVar('NODE_ENV', 'development') === 'test',
  
  // Logging
  LOG_LEVEL: getOptionalEnvVar('LOG_LEVEL', 'debug'),
  ENABLE_REQUEST_LOGGING: getBooleanEnvVar('ENABLE_REQUEST_LOGGING', true),
  
  // AgenticTrace Configuration
  DEFAULT_TRACE_TIMEOUT: getNumberEnvVar('DEFAULT_TRACE_TIMEOUT', 300000), // 5 minutes in ms
  MAX_EVENTS_PER_TRACE: getNumberEnvVar('MAX_EVENTS_PER_TRACE', 1000),
  DEFAULT_PAGE_SIZE: getNumberEnvVar('DEFAULT_PAGE_SIZE', 50),
  MAX_PAGE_SIZE: getNumberEnvVar('MAX_PAGE_SIZE', 100),
} as const;

// Type for environment configuration
export type EnvConfig = typeof env;

// Validation function to check required environment variables
export function validateEnvironment(): void {
  const requiredVars: Array<keyof typeof env> = [
    'API_KEY',
  ];
  
  const missingVars = requiredVars.filter(key => {
    const value = env[key];
    return value === undefined || value === '';
  });
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }
  
  // Firebase validation (optional but recommended)
  if (!env.FIREBASE_SERVICE_ACCOUNT && !env.FIREBASE_PROJECT_ID) {
    console.warn(
      'Warning: Firebase configuration is missing. ' +
      'Set FIREBASE_SERVICE_ACCOUNT and FIREBASE_DATABASE_URL for full functionality.'
    );
  }
}

// Export individual getters for backwards compatibility if needed
export { getEnvVar, getOptionalEnvVar, getBooleanEnvVar, getNumberEnvVar };