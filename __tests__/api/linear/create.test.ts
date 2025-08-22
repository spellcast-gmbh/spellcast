import { createMockRequest, mockLinearCreateResponse, mockLinearIssue } from '../../helpers/testUtils';

// Mock the Linear SDK before anything else
jest.mock('@linear/sdk');

// Create mock functions
const mockCreateIssue = jest.fn();

// Mock the linear client module
jest.doMock('../../../src/lib/linear', () => ({
  linearClient: {
    createIssue: mockCreateIssue,
  },
}));

describe('/api/linear/create', () => {
  let POST: any;

  beforeAll(async () => {
    // Import the module after setting up mocks
    const module = await import('../../../src/app/api/linear/create/route');
    POST = module.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should create a new issue with valid data', async () => {
      const issueData = {
        title: 'Test Issue',
        description: 'Test description',
        teamId: 'team-123',
        priority: 2,
      };

      mockCreateIssue.mockResolvedValue(mockLinearCreateResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/create', {
        method: 'POST',
        body: issueData,
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        id: mockLinearIssue.id,
        title: mockLinearIssue.title,
        description: mockLinearIssue.description,
        number: mockLinearIssue.number,
        url: mockLinearIssue.url,
        priority: mockLinearIssue.priority,
      });

      expect(mockCreateIssue).toHaveBeenCalledWith({
        title: issueData.title,
        description: issueData.description,
        teamId: issueData.teamId,
        assigneeId: undefined,
        priority: issueData.priority,
        labelIds: undefined,
        projectId: undefined,
        stateId: undefined,
      });
    });

    it('should return 400 for missing required fields', async () => {
      const issueData = {
        description: 'Missing title and teamId',
      };

      const request = createMockRequest('http://localhost:3000/api/linear/create', {
        method: 'POST',
        body: issueData,
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('required');
      expect(mockCreateIssue).not.toHaveBeenCalled();
    });

    it('should handle Linear API errors', async () => {
      const issueData = {
        title: 'Test Issue',
        teamId: 'team-123',
      };

      mockCreateIssue.mockRejectedValue(new Error('Linear API error'));

      const request = createMockRequest('http://localhost:3000/api/linear/create', {
        method: 'POST',
        body: issueData,
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Linear API error');
    });
  });
});