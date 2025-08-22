import { createMockRequest, mockLinearIssue, mockLinearCreateResponse } from '../../helpers/testUtils';

// Mock the Linear client before importing the route
const mockIssue = jest.fn();
const mockUpdateIssue = jest.fn();

jest.mock('../../../src/lib/linear', () => ({
  linearClient: {
    issue: mockIssue,
    updateIssue: mockUpdateIssue,
  },
}));

import { GET, PUT } from '../../../src/app/api/linear/[id]/route';

describe('/api/linear/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return issue by ID', async () => {
      mockIssue.mockResolvedValue(mockLinearIssue);

      const request = createMockRequest('http://localhost:3000/api/linear/test-id');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });
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

      expect(mockIssue).toHaveBeenCalledWith('test-id');
    });

    it('should return 404 when issue not found', async () => {
      mockIssue.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/linear/test-id');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Issue not found');
    });

    it('should return 400 when ID is missing', async () => {
      const request = createMockRequest('http://localhost:3000/api/linear/');
      const params = Promise.resolve({ id: '' });

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Issue ID is required');
      expect(mockIssue).not.toHaveBeenCalled();
    });

    it('should handle Linear API errors', async () => {
      mockIssue.mockRejectedValue(new Error('Linear API error'));

      const request = createMockRequest('http://localhost:3000/api/linear/test-id');
      const params = Promise.resolve({ id: 'test-id' });

      const response = await GET(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Internal server error');
    });
  });

  describe('PUT', () => {
    it('should update issue with valid data', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        priority: 1,
      };

      mockUpdateIssue.mockResolvedValue(mockLinearCreateResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/test-id', {
        method: 'PUT',
        body: updateData,
      });
      const params = Promise.resolve({ id: 'test-id' });

      const response = await PUT(request, { params });
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

      expect(mockUpdateIssue).toHaveBeenCalledWith('test-id', {
        title: updateData.title,
        description: updateData.description,
        assigneeId: undefined,
        priority: updateData.priority,
        labelIds: undefined,
        projectId: undefined,
        stateId: undefined,
      });
    });

    it('should update issue with partial data', async () => {
      const updateData = {
        title: 'Only Title Update',
      };

      mockUpdateIssue.mockResolvedValue(mockLinearCreateResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/test-id', {
        method: 'PUT',
        body: updateData,
      });
      const params = Promise.resolve({ id: 'test-id' });

      const response = await PUT(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      expect(mockUpdateIssue).toHaveBeenCalledWith('test-id', {
        title: updateData.title,
        description: undefined,
        assigneeId: undefined,
        priority: undefined,
        labelIds: undefined,
        projectId: undefined,
        stateId: undefined,
      });
    });

    it('should return 400 when ID is missing', async () => {
      const updateData = { title: 'Updated Title' };

      const request = createMockRequest('http://localhost:3000/api/linear/', {
        method: 'PUT',
        body: updateData,
      });
      const params = Promise.resolve({ id: '' });

      const response = await PUT(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Issue ID is required');
      expect(mockUpdateIssue).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid update data', async () => {
      const updateData = {
        title: 'x'.repeat(256), // Too long
        priority: 10, // Invalid priority
      };

      const request = createMockRequest('http://localhost:3000/api/linear/test-id', {
        method: 'PUT',
        body: updateData,
      });
      const params = Promise.resolve({ id: 'test-id' });

      const response = await PUT(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('must not exceed 255 characters');
      expect(mockUpdateIssue).not.toHaveBeenCalled();
    });

    it('should handle Linear API errors', async () => {
      const updateData = { title: 'Updated Title' };

      mockUpdateIssue.mockRejectedValue(new Error('Linear API error'));

      const request = createMockRequest('http://localhost:3000/api/linear/test-id', {
        method: 'PUT',
        body: updateData,
      });
      const params = Promise.resolve({ id: 'test-id' });

      const response = await PUT(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Linear API error');
    });

    it('should handle case when update returns null', async () => {
      const updateData = { title: 'Updated Title' };

      mockUpdateIssue.mockResolvedValue({
        issue: Promise.resolve(null),
      });

      const request = createMockRequest('http://localhost:3000/api/linear/test-id', {
        method: 'PUT',
        body: updateData,
      });
      const params = Promise.resolve({ id: 'test-id' });

      const response = await PUT(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Failed to update issue');
    });

    it('should handle empty update data', async () => {
      const updateData = {};

      mockUpdateIssue.mockResolvedValue(mockLinearCreateResponse);

      const request = createMockRequest('http://localhost:3000/api/linear/test-id', {
        method: 'PUT',
        body: updateData,
      });
      const params = Promise.resolve({ id: 'test-id' });

      const response = await PUT(request, { params });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      expect(mockUpdateIssue).toHaveBeenCalledWith('test-id', {
        title: undefined,
        description: undefined,
        assigneeId: undefined,
        priority: undefined,
        labelIds: undefined,
        projectId: undefined,
        stateId: undefined,
      });
    });
  });
});