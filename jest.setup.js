// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.LINEAR_API_KEY = 'test-linear-api-key';

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
