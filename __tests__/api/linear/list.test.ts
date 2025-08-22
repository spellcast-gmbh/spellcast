import { createMockRequest, mockLinearIssuesResponse } from '../../helpers/testUtils';

// Mock the Linear client before importing the route
const mockIssues = jest.fn();

jest.mock('../../../src/lib/linear', () => ({
  linearClient: {
    issues: mockIssues,
  },
}));

import { GET } from '../../../src/app/api/linear/list/route';

describe('/api/linear/list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should list issues with default parameters', async () => {
      mockIssues.mockResolvedValue(mockLinearIssuesResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/list');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.issues).toHaveLength(1);
      expect(responseData.data.issues[0]).toMatchObject({
        id: 'test-issue-id',
        title: 'Test Issue',
        description: 'Test issue description',
        number: 123,
        url: 'https://linear.app/test/issue/TST-123',
        priority: 2,
      });
      expect(responseData.data.pagination).toEqual({
        limit: 50,
        offset: 0,
      });

      expect(mockIssues).toHaveBeenCalledWith({
        filter: undefined,
        first: 50,
        after: undefined,
      });
    });

    it('should list issues with custom limit and offset', async () => {
      mockIssues.mockResolvedValue(mockLinearIssuesResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/list?limit=10&offset=20');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.pagination).toEqual({
        limit: 10,
        offset: 20,
      });

      expect(mockIssues).toHaveBeenCalledWith({
        filter: undefined,
        first: 10,
        after: '20',
      });
    });

    it('should list issues filtered by team', async () => {
      mockIssues.mockResolvedValue(mockLinearIssuesResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/list?teamId=team-123');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      expect(mockIssues).toHaveBeenCalledWith({
        filter: { team: { id: { eq: 'team-123' } } },
        first: 50,
        after: undefined,
      });
    });

    it('should return 400 for limit below 1', async () => {
      const request = createMockRequest('http://localhost:3000/api/linear/list?limit=0');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Limit must be between 1 and 100');
      expect(mockIssues).not.toHaveBeenCalled();
    });

    it('should return 400 for limit above 100', async () => {
      const request = createMockRequest('http://localhost:3000/api/linear/list?limit=150');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Limit must be between 1 and 100');
      expect(mockIssues).not.toHaveBeenCalled();
    });

    it('should return 400 for negative offset', async () => {
      const request = createMockRequest('http://localhost:3000/api/linear/list?offset=-1');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Offset must be non-negative');
      expect(mockIssues).not.toHaveBeenCalled();
    });

    it('should handle Linear API errors', async () => {
      mockIssues.mockRejectedValue(new Error('Linear API error'));

      const request = createMockRequest('http://localhost:3000/api/linear/list');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Internal server error');
    });

    it('should include pagination metadata', async () => {
      const paginatedResponse = {
        ...mockLinearIssuesResponse,
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
        },
      };

      mockIssues.mockResolvedValue(paginatedResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/list');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.totalCount).toBe(1);
      expect(responseData.data.hasNextPage).toBe(true);
      expect(responseData.data.hasPreviousPage).toBe(false);
    });
  });
});