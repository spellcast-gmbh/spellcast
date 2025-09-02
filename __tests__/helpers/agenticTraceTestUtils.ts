import { AgenticTrace, AgentEvent } from '@/models/agenticTraceSchemas';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock agent event object
 */
export const mockAgentEvent: AgentEvent = {
  id: uuidv4(),
  type: 'tool',
  agent: 'coordinator',
  input: {
    task: 'Test agent input',
    context: 'Test context'
  },
  output: {
    success: true,
    result: 'Planning completed successfully',
    type: 'completion'
  },
  markdown: '## Planning Results\n\nSuccessfully analyzed the input and created execution plan.',
  timestamp: '2024-01-01T12:00:00Z',
};

/**
 * Mock agentic trace object
 */
export const mockAgenticTrace: AgenticTrace = {
  id: uuidv4(),
  name: 'Test Trace',
  initialInput: 'Test initial input',
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T12:35:00Z',
  duration: 9000,
  events: [mockAgentEvent],
  status: 'completed',
  agentHint: 'coordinator',
};

/**
 * Mock create trace request
 */
export const mockCreateTraceRequest = {
  name: 'Test Trace',
  prompt: 'Test input for processing',
  agentHint: 'planner',
};

/**
 * Mock create trace request (blocking)
 */
export const mockCreateTraceRequestBlocking = {
  name: 'Blocking Test Trace',
  prompt: 'Test input for blocking processing',
  agentHint: 'researcher',
  blocking: true,
};

/**
 * Generate a mock trace with custom properties
 */
export function generateMockTrace(overrides: Partial<AgenticTrace> = {}): AgenticTrace {
  return {
    ...mockAgenticTrace,
    id: uuidv4(),
    ...overrides,
  };
}

/**
 * Generate multiple mock traces for list testing
 */
export function generateMockTraces(count: number): AgenticTrace[] {
  return Array.from({ length: count }, (_, index) => 
    generateMockTrace({
      name: `Test Trace ${index + 1}`,
      createdAt: new Date(Date.now() - (count - index) * 60000).toISOString(),
    })
  );
}

/**
 * Mock Firebase service responses
 */
export class MockAgenticTraceFirebaseService {
  private traces = new Map<string, AgenticTrace>();
  
  constructor() {
    // Pre-populate with some test data
    const testTraces = generateMockTraces(3);
    testTraces.forEach(trace => {
      this.traces.set(trace.id, trace);
    });
  }

  async createTrace(trace: Omit<AgenticTrace, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgenticTrace> {
    const now = new Date().toISOString();
    const newTrace: AgenticTrace = {
      ...trace,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    
    this.traces.set(newTrace.id, newTrace);
    return newTrace;
  }

  async getTrace(id: string): Promise<AgenticTrace | null> {
    return this.traces.get(id) || null;
  }

  async updateTrace(id: string, updates: Partial<Omit<AgenticTrace, 'id' | 'createdAt'>>): Promise<void> {
    const trace = this.traces.get(id);
    if (trace) {
      const updatedTrace = {
        ...trace,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.traces.set(id, updatedTrace);
    }
  }

  async addEventToTrace(traceId: string, event: Omit<AgentEvent, 'id'>): Promise<AgentEvent> {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error('Trace not found');
    }

    const fullEvent: AgentEvent = {
      ...event,
      id: uuidv4(),
    };

    const updatedTrace = {
      ...trace,
      events: [...trace.events, fullEvent],
      updatedAt: new Date().toISOString(),
    };

    this.traces.set(traceId, updatedTrace);
    return fullEvent;
  }

  async listTraces(options: {
    cursor?: string;
    limit: number;
    orderBy: 'createdAt' | 'updatedAt' | 'name';
    orderDirection: 'asc' | 'desc';
    fields?: string[];
  }) {
    let tracesArray = Array.from(this.traces.values());

    // Sort traces
    tracesArray.sort((a, b) => {
      const aVal = a[options.orderBy];
      const bVal = b[options.orderBy];
      const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return options.orderDirection === 'desc' ? -result : result;
    });

    // Handle cursor pagination
    if (options.cursor) {
      const cursorIndex = tracesArray.findIndex(trace => trace.id === options.cursor);
      if (cursorIndex >= 0) {
        tracesArray = tracesArray.slice(cursorIndex + 1);
      }
    }

    // Apply limit and check for more
    const hasMore = tracesArray.length > options.limit;
    const traces = tracesArray.slice(0, options.limit);
    const nextCursor = hasMore ? traces[traces.length - 1]?.id || null : null;

    // Apply field projection if specified
    let resultTraces = traces;
    if (options.fields && options.fields.length > 0) {
      resultTraces = traces.map(trace => {
        const projected: any = { id: trace.id };
        options.fields!.forEach(field => {
          if (field in trace) {
            projected[field] = (trace as any)[field];
          }
        });
        return projected;
      });
    }

    return {
      traces: resultTraces,
      hasMore,
      nextCursor,
    };
  }

  async deleteTrace(id: string): Promise<void> {
    this.traces.delete(id);
  }

  // Test utilities
  getTraceCount(): number {
    return this.traces.size;
  }

  getAllTraces(): AgenticTrace[] {
    return Array.from(this.traces.values());
  }

  reset(): void {
    this.traces.clear();
  }
}

/**
 * Create a mock request with proper authentication
 */
export function createAuthenticatedMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
) {
  const defaultHeaders = {
    'Authorization': 'Bearer test-api-key',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return new Request(url, {
    method: options.method || 'GET',
    headers: defaultHeaders,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}