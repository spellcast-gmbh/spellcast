import {
  createIssueSchema,
  updateIssueSchema,
  searchIssuesSchema,
  getIssueSchema,
} from '../../src/models/issueSchemas';

describe('Issue Schemas', () => {
  describe('createIssueSchema', () => {
    it('should validate valid create issue data', async () => {
      const validData = {
        title: 'Test Issue',
        description: 'Test description',
        teamId: 'team-123',
        assigneeId: 'user-456',
        priority: 2,
        labelIds: ['label-1', 'label-2'],
        projectId: 'project-789',
        stateId: 'state-abc',
      };

      const result = await createIssueSchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should validate minimal create issue data', async () => {
      const minimalData = {
        title: 'Test Issue',
        teamId: 'team-123',
      };

      const result = await createIssueSchema.validate(minimalData);
      expect(result.title).toBe('Test Issue');
      expect(result.teamId).toBe('team-123');
    });

    it('should reject missing title', async () => {
      const invalidData = {
        teamId: 'team-123',
      };

      await expect(createIssueSchema.validate(invalidData)).rejects.toThrow('Title is required');
    });

    it('should reject missing teamId', async () => {
      const invalidData = {
        title: 'Test Issue',
      };

      await expect(createIssueSchema.validate(invalidData)).rejects.toThrow('Team ID is required');
    });

    it('should reject empty title', async () => {
      const invalidData = {
        title: '',
        teamId: 'team-123',
      };

      await expect(createIssueSchema.validate(invalidData)).rejects.toThrow('Title is required');
    });

    it('should reject title too long', async () => {
      const invalidData = {
        title: 'x'.repeat(256),
        teamId: 'team-123',
      };

      await expect(createIssueSchema.validate(invalidData)).rejects.toThrow('Title must not exceed 255 characters');
    });

    it('should reject invalid priority', async () => {
      const invalidData = {
        title: 'Test Issue',
        teamId: 'team-123',
        priority: 10,
      };

      await expect(createIssueSchema.validate(invalidData)).rejects.toThrow('Priority must be between 0 and 4');
    });

    it('should reject negative priority', async () => {
      const invalidData = {
        title: 'Test Issue',
        teamId: 'team-123',
        priority: -1,
      };

      await expect(createIssueSchema.validate(invalidData)).rejects.toThrow('Priority must be between 0 and 4');
    });

    it('should accept valid priority values', async () => {
      for (let priority = 0; priority <= 4; priority++) {
        const data = {
          title: 'Test Issue',
          teamId: 'team-123',
          priority,
        };

        const result = await createIssueSchema.validate(data);
        expect(result.priority).toBe(priority);
      }
    });

    it('should accept labelIds as array', async () => {
      const data = {
        title: 'Test Issue',
        teamId: 'team-123',
        labelIds: ['label-1', 'label-2', 'label-3'],
      };

      const result = await createIssueSchema.validate(data);
      expect(result.labelIds).toEqual(['label-1', 'label-2', 'label-3']);
    });
  });

  describe('updateIssueSchema', () => {
    it('should validate valid update data', async () => {
      const validData = {
        title: 'Updated Title',
        description: 'Updated description',
        priority: 1,
      };

      const result = await updateIssueSchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should validate empty update data', async () => {
      const emptyData = {};

      const result = await updateIssueSchema.validate(emptyData);
      expect(result).toEqual({});
    });

    it('should reject title too long', async () => {
      const invalidData = {
        title: 'x'.repeat(256),
      };

      await expect(updateIssueSchema.validate(invalidData)).rejects.toThrow('Title must not exceed 255 characters');
    });

    it('should reject empty title', async () => {
      const invalidData = {
        title: '',
      };

      await expect(updateIssueSchema.validate(invalidData)).rejects.toThrow('Title must not be empty');
    });

    it('should reject invalid priority', async () => {
      const invalidData = {
        priority: 5,
      };

      await expect(updateIssueSchema.validate(invalidData)).rejects.toThrow('Priority must be between 0 and 4');
    });
  });

  describe('searchIssuesSchema', () => {
    it('should validate valid search parameters', async () => {
      const validData = {
        query: 'test search',
        teamId: 'team-123',
        assigneeId: 'user-456',
        stateId: 'state-789',
        projectId: 'project-abc',
        limit: 25,
        offset: 10,
      };

      const result = await searchIssuesSchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should validate empty search parameters', async () => {
      const emptyData = {};

      const result = await searchIssuesSchema.validate(emptyData);
      expect(result).toEqual({});
    });

    it('should reject limit below 1', async () => {
      const invalidData = {
        limit: 0,
      };

      await expect(searchIssuesSchema.validate(invalidData)).rejects.toThrow('Limit must be at least 1');
    });

    it('should reject limit above 100', async () => {
      const invalidData = {
        limit: 101,
      };

      await expect(searchIssuesSchema.validate(invalidData)).rejects.toThrow('Limit must not exceed 100');
    });

    it('should reject negative offset', async () => {
      const invalidData = {
        offset: -1,
      };

      await expect(searchIssuesSchema.validate(invalidData)).rejects.toThrow('Offset must be non-negative');
    });

    it('should accept valid limit range', async () => {
      for (let limit of [1, 50, 100]) {
        const data = { limit };
        const result = await searchIssuesSchema.validate(data);
        expect(result.limit).toBe(limit);
      }
    });

    it('should accept zero offset', async () => {
      const data = { offset: 0 };
      const result = await searchIssuesSchema.validate(data);
      expect(result.offset).toBe(0);
    });
  });

  describe('getIssueSchema', () => {
    it('should validate valid issue ID', async () => {
      const validData = {
        id: 'test-issue-id',
      };

      const result = await getIssueSchema.validate(validData);
      expect(result).toEqual(validData);
    });

    it('should reject missing ID', async () => {
      const invalidData = {};

      await expect(getIssueSchema.validate(invalidData)).rejects.toThrow('Issue ID is required');
    });

    it('should reject empty ID', async () => {
      const invalidData = {
        id: '',
      };

      await expect(getIssueSchema.validate(invalidData)).rejects.toThrow('Issue ID is required');
    });
  });
});
