import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { createMockRequest } from './helpers/testUtils';

// Mock the auth module
jest.mock('../src/lib/auth', () => ({
  validateApiKey: jest.fn(),
  createUnauthorizedResponse: jest.fn(() => new Response('Unauthorized', { status: 401 })),
}));

import { validateApiKey, createUnauthorizedResponse } from '../src/lib/auth';

const mockValidateApiKey = validateApiKey as jest.MockedFunction<typeof validateApiKey>;
const mockCreateUnauthorizedResponse = createUnauthorizedResponse as jest.MockedFunction<typeof createUnauthorizedResponse>;

describe('Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow requests to non-API routes without authentication', () => {
    const request = createMockRequest('http://localhost:3000/');

    const response = middleware(request);

    expect(mockValidateApiKey).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('should validate API key for API routes', () => {
    mockValidateApiKey.mockReturnValue(true);
    const request = createMockRequest('http://localhost:3000/api/linear/list');

    const response = middleware(request);

    expect(mockValidateApiKey).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });

  it('should return unauthorized response for invalid API key', () => {
    mockValidateApiKey.mockReturnValue(false);
    const request = createMockRequest('http://localhost:3000/api/linear/list');

    const response = middleware(request);

    expect(mockValidateApiKey).toHaveBeenCalledWith(request);
    expect(mockCreateUnauthorizedResponse).toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it('should protect all API routes', () => {
    mockValidateApiKey.mockReturnValue(true);
    
    const apiRoutes = [
      '/api/linear/create',
      '/api/linear/test-id',
      '/api/linear/search',
      '/api/linear/list',
    ];

    apiRoutes.forEach(route => {
      const request = createMockRequest(`http://localhost:3000${route}`);
      const response = middleware(request);
      
      expect(mockValidateApiKey).toHaveBeenCalledWith(request);
      expect(response.status).toBe(200);
    });

    expect(mockValidateApiKey).toHaveBeenCalledTimes(apiRoutes.length);
  });
});
