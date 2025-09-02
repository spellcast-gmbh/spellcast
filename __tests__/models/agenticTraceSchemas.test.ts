import { 
  AgentTypeSchema,
  AgentEventSchema,
  AgenticTraceSchema,
  CreateTraceRequestSchema,
  ListTracesRequestSchema,
  GetTraceRequestSchema,
} from '../../src/models/agenticTraceSchemas';
import { v4 as uuidv4 } from 'uuid';

describe('AgenticTrace Zod Schemas', () => {
  describe('AgentTypeSchema', () => {
    it('should validate valid agent types', () => {
      const validTypes = ['coordinator', 'linear'];
      
      validTypes.forEach(type => {
        expect(() => AgentTypeSchema.parse(type)).not.toThrow();
      });
    });

    it('should reject invalid agent types', () => {
      const invalidTypes = ['invalid', 'manager', ''];
      
      invalidTypes.forEach(type => {
        expect(() => AgentTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('AgentEventSchema', () => {
    const validEvent = {
      id: uuidv4(),
      type: 'tool',
      agent: 'coordinator',
      input: { task: 'Event input', context: 'Test context' },
      output: { success: true, result: 'Completed' },
      markdown: '## Results\n\nTask completed successfully.',
      timestamp: '2024-01-01T12:00:00Z',
    };

    it('should validate a valid agent event', () => {
      expect(() => AgentEventSchema.parse(validEvent)).not.toThrow();
      const parsed = AgentEventSchema.parse(validEvent);
      expect(parsed).toMatchObject(validEvent);
    });

    it('should validate event with minimal required fields', () => {
      const minimalEvent = {
        id: uuidv4(),
        type: 'start',
        agent: 'linear',
        input: { task: 'Event input' },
        output: { success: true },
        timestamp: '2024-01-01T12:00:00Z',
      };
      
      expect(() => AgentEventSchema.parse(minimalEvent)).not.toThrow();
      const parsed = AgentEventSchema.parse(minimalEvent);
      expect(parsed.type).toBe('start');
      expect(parsed.agent).toBe('linear');
    });

    it('should reject event with invalid type', () => {
      const invalidEvent = { ...validEvent, type: 'invalid' };
      expect(() => AgentEventSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with invalid agent', () => {
      const invalidEvent = { ...validEvent, agent: 'invalid' };
      expect(() => AgentEventSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with missing required fields', () => {
      const { output: _, ...eventWithoutOutput } = validEvent;
      expect(() => AgentEventSchema.parse(eventWithoutOutput)).toThrow();
    });
  });

  describe('AgenticTraceSchema', () => {
    const validTrace = {
      id: uuidv4(),
      name: 'Test Trace',
      initialInput: 'Initial input',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T12:00:00Z',
      duration: 7200000,
      events: [],
      status: 'completed',
      agentHint: 'coordinator',
    };

    it('should validate a valid agentic trace', () => {
      expect(() => AgenticTraceSchema.parse(validTrace)).not.toThrow();
      const parsed = AgenticTraceSchema.parse(validTrace);
      expect(parsed).toMatchObject(validTrace);
    });

    it('should validate trace with minimal required fields', () => {
      const minimalTrace = {
        id: uuidv4(),
        name: 'Test Trace',
        initialInput: 'Initial input',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
      };
      
      expect(() => AgenticTraceSchema.parse(minimalTrace)).not.toThrow();
      const parsed = AgenticTraceSchema.parse(minimalTrace);
      expect(parsed.events).toEqual([]); // Default value
      expect(parsed.status).toBe('pending'); // Default value
    });

    it('should reject trace with empty name', () => {
      const invalidTrace = { ...validTrace, name: '' };
      expect(() => AgenticTraceSchema.parse(invalidTrace)).toThrow();
    });

    it('should reject trace with name too long', () => {
      const invalidTrace = { ...validTrace, name: 'x'.repeat(256) };
      expect(() => AgenticTraceSchema.parse(invalidTrace)).toThrow();
    });

    it('should reject trace with empty initial input', () => {
      const invalidTrace = { ...validTrace, initialInput: '' };
      expect(() => AgenticTraceSchema.parse(invalidTrace)).toThrow();
    });

    it('should reject trace with invalid status', () => {
      const invalidTrace = { ...validTrace, status: 'invalid' };
      expect(() => AgenticTraceSchema.parse(invalidTrace)).toThrow();
    });
  });

  describe('CreateTraceRequestSchema', () => {
    const validRequest = {
      name: 'Test Trace',
      input: 'Test input',
      firstAgent: 'planner',
      blocking: true,
      agentHint: 'planner',
    };

    it('should validate a valid create request', () => {
      expect(() => CreateTraceRequestSchema.parse(validRequest)).not.toThrow();
      const parsed = CreateTraceRequestSchema.parse(validRequest);
      expect(parsed).toMatchObject(validRequest);
    });

    it('should validate request with minimal fields', () => {
      const minimalRequest = {
        name: 'Test Trace',
        input: 'Test input',
      };
      
      expect(() => CreateTraceRequestSchema.parse(minimalRequest)).not.toThrow();
      const parsed = CreateTraceRequestSchema.parse(minimalRequest);
      expect(parsed.blocking).toBe(false); // Default value
    });

    it('should reject request with empty name', () => {
      const invalidRequest = { ...validRequest, name: '' };
      expect(() => CreateTraceRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject request with empty input', () => {
      const invalidRequest = { ...validRequest, input: '' };
      expect(() => CreateTraceRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject request with invalid first agent', () => {
      const invalidRequest = { ...validRequest, firstAgent: 'invalid' };
      expect(() => CreateTraceRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('ListTracesRequestSchema', () => {
    it('should validate valid list request', () => {
      const validRequest = {
        cursor: uuidv4(),
        limit: 25,
        orderBy: 'createdAt',
        orderDirection: 'desc',
        fields: 'id,name,status',
      };
      
      expect(() => ListTracesRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should apply defaults for missing fields', () => {
      const minimalRequest = {};
      const parsed = ListTracesRequestSchema.parse(minimalRequest);
      
      expect(parsed.limit).toBe(50);
      expect(parsed.orderBy).toBe('createdAt');
      expect(parsed.orderDirection).toBe('desc');
    });

    it('should reject invalid limit values', () => {
      expect(() => ListTracesRequestSchema.parse({ limit: 0 })).toThrow();
      expect(() => ListTracesRequestSchema.parse({ limit: 101 })).toThrow();
    });

    it('should reject invalid order directions', () => {
      expect(() => ListTracesRequestSchema.parse({ orderDirection: 'invalid' })).toThrow();
    });
  });

  describe('GetTraceRequestSchema', () => {
    it('should validate valid get request', () => {
      const validRequest = {
        id: uuidv4(),
        fields: 'id,name,status,events',
      };
      
      expect(() => GetTraceRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should validate request without fields', () => {
      const validRequest = {
        id: uuidv4(),
      };
      
      expect(() => GetTraceRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      const invalidRequest = {
        id: 'not-a-uuid',
      };
      
      expect(() => GetTraceRequestSchema.parse(invalidRequest)).toThrow();
    });
  });
});