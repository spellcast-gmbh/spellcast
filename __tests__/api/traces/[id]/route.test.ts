import { createMockRequest } from '../../../helpers/testUtils';
import { 
  MockAgenticTraceFirebaseService,
  generateMockTraces
} from '../../../helpers/agenticTraceTestUtils';

// Mock the Firebase service before anything else
const mockFirebaseService = new MockAgenticTraceFirebaseService();

jest.mock('../../../../src/lib/firebase', () => ({
  agenticTraceService: mockFirebaseService,
}));

// Mock the auth module to return true for valid API keys
jest.mock('../../../../src/lib/auth', () => ({
  validateApiKey: jest.fn((request) => {
    const authHeader = request.headers.get('authorization');
    return authHeader === 'Bearer test-api-key';
  }),
}));

describe('/api/traces/[id]', () => {
  let GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  let PUT: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  let DELETE: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  let testTraces: { id: string; name: string; initialInput: string; events: unknown[]; status: string; agentHint: string }[];

  beforeAll(async () => {
    // Import the module after setting up mocks
    const routeModule = await import('../../../../src/app/api/traces/[id]/route');
    GET = routeModule.GET;
    PUT = routeModule.PUT;
    DELETE = routeModule.DELETE;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFirebaseService.reset();
    
    // Add test data
    testTraces = [];
    const mockTraces = generateMockTraces(3);
    for (const trace of mockTraces) {
      const createdTrace = await mockFirebaseService.createTrace({
        name: trace.name,
        initialInput: trace.initialInput,
        events: trace.events,
        status: trace.status,
        agentHint: trace.agentHint,
      });
      testTraces.push(createdTrace);
    }
  });

  describe('GET /api/traces/[id]', () => {
    it('should get a trace by ID', async () => {
      const trace = testTraces[0];
      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        id: trace.id,
        name: trace.name,
        initialInput: trace.initialInput,
        status: trace.status,
      });
    });

    it('should get a trace with field selection', async () => {
      const trace = testTraces[0];
      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}?fields=id,name,status`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      
      // Check that only requested fields are present
      expect(Object.keys(responseData.data)).toEqual(expect.arrayContaining(['id', 'name', 'status']));
      expect(responseData.data).not.toHaveProperty('initialInput');
      expect(responseData.data).not.toHaveProperty('events');
    });

    it('should return 404 for non-existent trace', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';
      const request = createMockRequest(`http://localhost:3000/api/traces/${nonExistentId}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request, { params: Promise.resolve({ id: nonExistentId }) });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Trace not found');
    });

    it('should return 401 for invalid authentication', async () => {
      const trace = testTraces[0];
      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-key',
        },
      });

      const response = await GET(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Unauthorized');
    });

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';
      const request = createMockRequest(`http://localhost:3000/api/traces/${invalidId}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request, { params: Promise.resolve({ id: invalidId }) });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Validation error');
      expect(responseData.details).toContain('uuid');
    });
  });

  describe('PUT /api/traces/[id]', () => {
    it('should add an event to a trace', async () => {
      const trace = testTraces[0];
      const eventToAdd = {
        type: 'tool',
        agent: 'coordinator',
        input: { task: 'New event input' },
        output: { 
          success: true,
          result: 'Task completed',
        },
        markdown: '## Task Results\n\nSuccessfully executed the task.',
        timestamp: new Date().toISOString(),
      };

      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: { event: eventToAdd },
      });

      const response = await PUT(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.events).toHaveLength(2); // Original + new event
      
      const newEvent = responseData.data.events[1];
      expect(newEvent).toMatchObject(eventToAdd);
      expect(newEvent.id).toBeDefined();
    });

    it('should update trace status', async () => {
      const trace = testTraces[0];
      const updateData = {
        status: 'completed',
        duration: 5000,
        agentHint: 'coordinator',
      };

      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: updateData,
      });

      const response = await PUT(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        status: 'completed',
        duration: 5000,
      });
    });

    it('should return 404 for non-existent trace', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';
      const request = createMockRequest(`http://localhost:3000/api/traces/${nonExistentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: { status: 'completed' },
      });

      const response = await PUT(request, { params: Promise.resolve({ id: nonExistentId }) });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Trace not found');
    });

    it('should return 400 for empty update', async () => {
      const trace = testTraces[0];
      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: {},
      });

      const response = await PUT(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('No valid fields to update');
    });

    it('should return 401 for invalid authentication', async () => {
      const trace = testTraces[0];
      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer invalid-key',
          'Content-Type': 'application/json',
        },
        body: { status: 'completed' },
      });

      const response = await PUT(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Unauthorized');
    });
  });

  describe('DELETE /api/traces/[id]', () => {
    it('should delete a trace', async () => {
      const trace = testTraces[0];
      const initialCount = mockFirebaseService.getTraceCount();

      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.message).toBe('Trace deleted successfully');
      expect(mockFirebaseService.getTraceCount()).toBe(initialCount - 1);
      
      // Verify trace is actually deleted
      const deletedTrace = await mockFirebaseService.getTrace(trace.id);
      expect(deletedTrace).toBeNull();
    });

    it('should return 404 for non-existent trace', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';
      const request = createMockRequest(`http://localhost:3000/api/traces/${nonExistentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: nonExistentId }) });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Trace not found');
    });

    it('should return 401 for invalid authentication', async () => {
      const trace = testTraces[0];
      const request = createMockRequest(`http://localhost:3000/api/traces/${trace.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer invalid-key',
        },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: trace.id }) });
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Unauthorized');
    });
  });
});