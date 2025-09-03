// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.LINEAR_API_KEY = 'test-linear-api-key';
process.env.VERCEL_API_KEY = 'test-vercel-api-key';
process.env.OPENAI_API_KEY = 'test-openai-api-key';
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  type: 'service_account',
  project_id: 'test-project',
  client_email: 'test@test.com',
  private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n'
});
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_DATABASE_URL = 'https://test-project.firebaseio.com';
process.env.BASE_URL = 'http://localhost:3000';

// Mock the Linear SDK
jest.mock('@linear/sdk', () => {
  return {
    LinearClient: jest.fn().mockImplementation(() => ({
      createIssue: jest.fn(),
      issue: jest.fn(),
      updateIssue: jest.fn(),
      issues: jest.fn(),
    })),
  };
});

// Suppress console.error in tests unless needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('Error:'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
