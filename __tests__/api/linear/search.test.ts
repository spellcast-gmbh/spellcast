import { createMockRequest, mockLinearIssuesResponse } from '../../helpers/testUtils';

// Mock the Linear client and entity resolver before importing the route
jest.mock('../../../src/lib/linear', () => ({
  linearClient: {
    issues: jest.fn(),
  },
  LinearEntityResolver: {
    resolveTeam: jest.fn(),
    resolveUser: jest.fn(),
    resolveProject: jest.fn(),
    resolveState: jest.fn(),
  },
}));

import { GET } from '../../../src/app/api/linear/search/route';
import { linearClient, LinearEntityResolver } from '../../../src/lib/linear';

const mockIssues = linearClient.issues as jest.MockedFunction<typeof linearClient.issues>;
const mockResolveTeam = LinearEntityResolver.resolveTeam as jest.MockedFunction<typeof LinearEntityResolver.resolveTeam>;
const mockResolveUser = LinearEntityResolver.resolveUser as jest.MockedFunction<typeof LinearEntityResolver.resolveUser>;
const mockResolveProject = LinearEntityResolver.resolveProject as jest.MockedFunction<typeof LinearEntityResolver.resolveProject>;
const mockResolveState = LinearEntityResolver.resolveState as jest.MockedFunction<typeof LinearEntityResolver.resolveState>;

describe('/api/linear/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should search issues without filters', async () => {
      mockIssues.mockResolvedValue(mockLinearIssuesResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/search');

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

      expect(mockIssues).toHaveBeenCalledWith({
        filter: undefined,
        first: 50,
        after: undefined,
      });
    });

    it('should search issues with team filter', async () => {
      mockIssues.mockResolvedValue(mockLinearIssuesResponse);
      mockResolveTeam.mockResolvedValue({
        id: 'team-123',
        name: 'Engineering',
        key: 'ENG'
      });

      const request = createMockRequest('http://localhost:3000/api/linear/search?teamId=team-123');

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

    it('should search issues with multiple filters', async () => {
      mockIssues.mockResolvedValue(mockLinearIssuesResponse);

      const validAssigneeUuid = '12345678-1234-1234-1234-123456789abc';
      
      // Mock all entity resolvers
      mockResolveTeam.mockResolvedValue({
        id: 'team-123',
        name: 'Engineering',
        key: 'ENG'
      });
      mockResolveUser.mockResolvedValue({
        id: validAssigneeUuid,
        name: 'John Doe',
        displayName: 'John',
        email: 'john@example.com'
      });
      mockResolveState.mockResolvedValue({
        id: 'state-789',
        name: 'In Progress',
        type: 'started',
        color: '#FFA500'
      });

      const request = createMockRequest(
        `http://localhost:3000/api/linear/search?teamId=team-123&assigneeId=${validAssigneeUuid}&stateId=state-789`
      );

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      expect(mockIssues).toHaveBeenCalledWith({
        filter: {
          team: { id: { eq: 'team-123' } },
          assignee: { id: { eq: validAssigneeUuid } },
          state: { id: { eq: 'state-789' } },
        },
        first: 50,
        after: undefined,
      });
    });

    it('should search issues with text query', async () => {
      const issueWithSearchText = {
        ...mockLinearIssuesResponse.nodes[0],
        title: 'Bug in login system',
        description: 'Users cannot login properly',
      };

      mockIssues.mockResolvedValue({
        ...mockLinearIssuesResponse,
        nodes: [issueWithSearchText],
      });

      const request = createMockRequest('http://localhost:3000/api/linear/search?query=login');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.issues).toHaveLength(1);
      expect(responseData.data.issues[0].title).toBe('Bug in login system');
    });

    it('should handle pagination parameters', async () => {
      mockIssues.mockResolvedValue(mockLinearIssuesResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/search?limit=10&offset=20');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      expect(mockIssues).toHaveBeenCalledWith({
        filter: undefined,
        first: 10,
        after: '20',
      });
    });

    it('should return 400 for invalid limit', async () => {
      const request = createMockRequest('http://localhost:3000/api/linear/search?limit=150');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Limit must not exceed 100');
      expect(mockIssues).not.toHaveBeenCalled();
    });

    it('should return 400 for negative offset', async () => {
      const request = createMockRequest('http://localhost:3000/api/linear/search?offset=-5');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Offset must be non-negative');
      expect(mockIssues).not.toHaveBeenCalled();
    });

    it('should handle Linear API errors', async () => {
      mockIssues.mockRejectedValue(new Error('Linear API error'));

      const request = createMockRequest('http://localhost:3000/api/linear/search');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Linear API error');
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

      const request = createMockRequest('http://localhost:3000/api/linear/search');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.totalCount).toBe(1);
      expect(responseData.data.hasNextPage).toBe(true);
      expect(responseData.data.hasPreviousPage).toBe(false);
    });

    it('should reject assignee search with non-UUID value "cursor" when entity not found', async () => {
      // Mock resolver to return null (not found)
      mockResolveUser.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/linear/search?assigneeId=cursor');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain("Assignee 'cursor' not found");
      
      // Verify that the Linear client was NOT called due to entity not found
      expect(mockIssues).not.toHaveBeenCalled();
    });

    it('should accept valid UUID assigneeId', async () => {
      mockIssues.mockResolvedValue(mockLinearIssuesResponse);

      const validUuid = '12345678-1234-1234-1234-123456789abc';
      
      // Mock resolver to return found user
      mockResolveUser.mockResolvedValue({
        id: validUuid,
        name: 'John Doe',
        displayName: 'John',
        email: 'john@example.com'
      });

      const request = createMockRequest(`http://localhost:3000/api/linear/search?assigneeId=${validUuid}`);

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      
      // Verify that the Linear client was called with the valid UUID
      expect(mockIssues).toHaveBeenCalledWith({
        filter: {
          assignee: { id: { eq: validUuid } }
        },
        first: 50,
        after: undefined,
      });
    });
  });
});