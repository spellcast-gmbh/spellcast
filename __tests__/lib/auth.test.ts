import { createMockRequest } from '../helpers/testUtils';

// Mock the env module before importing auth
jest.mock('../../src/lib/env', () => ({
  env: {
    API_KEY: 'test-api-key'
  }
}));

import { validateApiKey, createUnauthorizedResponse } from '../../src/lib/auth';

describe('Authentication utilities', () => {

  describe('validateApiKey', () => {
    it('should return true for valid Bearer token in Authorization header', () => {
      const request = createMockRequest('http://localhost:3000/api/test', {
        headers: {
          'authorization': 'Bearer test-api-key',
        },
      });

      expect(validateApiKey(request)).toBe(true);
    });

    it('should return false for invalid Bearer token', () => {
      const request = createMockRequest('http://localhost:3000/api/test', {
        headers: {
          'authorization': 'Bearer invalid-key',
        },
      });

      expect(validateApiKey(request)).toBe(false);
    });

    it('should return false when no API key is provided', () => {
      const request = createMockRequest('http://localhost:3000/api/test');

      expect(validateApiKey(request)).toBe(false);
    });

    it('should return false when Authorization header has wrong format', () => {
      const request = createMockRequest('http://localhost:3000/api/test', {
        headers: {
          'authorization': 'Basic test-api-key',
        },
      });

      expect(validateApiKey(request)).toBe(false);
    });

    it('should return false when API_KEY environment variable is not set', async () => {
      // Re-mock the env module to have no API_KEY
      jest.doMock('../../src/lib/env', () => ({
        env: {
          API_KEY: undefined
        }
      }));
      
      // Need to re-import after mocking
      jest.resetModules();
      const authModule = await import('../../src/lib/auth');
      const { validateApiKey: validateApiKeyNoEnv } = authModule;
      
      const request = createMockRequest('http://localhost:3000/api/test', {
        headers: {
          'authorization': 'Bearer test-api-key',
        },
      });

      expect(validateApiKeyNoEnv(request)).toBe(false);
    });
  });

  describe('createUnauthorizedResponse', () => {
    it('should return 401 response with proper error message', async () => {
      const response = createUnauthorizedResponse();

      expect(response.status).toBe(401);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const body = await response.json();
      expect(body).toEqual({
        error: 'Unauthorized - Invalid or missing API key',
      });
    });
  });
});
