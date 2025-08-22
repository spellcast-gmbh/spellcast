import { validateApiKey, createUnauthorizedResponse } from '../../src/lib/auth';
import { createMockRequest } from '../helpers/testUtils';

describe('Authentication utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.API_KEY = 'test-api-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateApiKey', () => {
    it('should return true for valid Bearer token in Authorization header', () => {
      const request = createMockRequest('http://localhost:3000/api/test', {
        headers: {
          'authorization': 'Bearer test-api-key',
        },
      });

      expect(validateApiKey(request)).toBe(true);
    });

    it('should return true for valid API key in query parameter', () => {
      const request = createMockRequest('http://localhost:3000/api/test?Bearer=test-api-key');

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

    it('should return false for invalid query parameter', () => {
      const request = createMockRequest('http://localhost:3000/api/test?Bearer=invalid-key');

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

    it('should return false when API_KEY environment variable is not set', () => {
      delete process.env.API_KEY;
      
      const request = createMockRequest('http://localhost:3000/api/test', {
        headers: {
          'authorization': 'Bearer test-api-key',
        },
      });

      expect(validateApiKey(request)).toBe(false);
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
