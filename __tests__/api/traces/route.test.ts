import { createMockRequest } from '../../helpers/testUtils';
import { 
  mockCreateTraceRequest, 
  mockCreateTraceRequestBlocking,
  MockAgenticTraceFirebaseService,
  generateMockTraces
} from '../../helpers/agenticTraceTestUtils';

// Mock the Firebase service before anything else
const mockFirebaseService = new MockAgenticTraceFirebaseService();

jest.mock('../../../src/lib/firebase', () => ({
  agenticTraceService: mockFirebaseService,
}));

// Mock the auth module to return true for valid API keys
jest.mock('../../../src/lib/auth', () => ({
  validateApiKey: jest.fn((request) => {
    const authHeader = request.headers.get('authorization');
    return authHeader === 'Bearer test-api-key';
  }),
}));

describe('/api/traces', () => {
  let POST: (request: Request) => Promise<Response>;
  let GET: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    // Import the module after setting up mocks
    const routeModule = await import('../../../src/app/api/traces/route');
    POST = routeModule.POST;
    GET = routeModule.GET;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFirebaseService.reset();
    // Add some test data
    const testTraces = generateMockTraces(3);
    for (const trace of testTraces) {
      await mockFirebaseService.createTrace({
        name: trace.name,
        initialInput: trace.initialInput,
        events: trace.events,
        status: trace.status,
        agentHint: trace.agentHint,
      });
    }
  });

  describe('POST /api/traces', () => {
    it('should create a new trace in non-blocking mode', async () => {
      const request = createMockRequest('http://localhost:3000/api/traces', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: mockCreateTraceRequest,
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        name: mockCreateTraceRequest.name,
        status: 'pending',
      });
      expect(responseData.data.id).toBeDefined();
      expect(responseData.data.createdAt).toBeDefined();
    });

    it('should create and complete a trace in blocking mode', async () => {
      const request = createMockRequest('http://localhost:3000/api/traces', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: mockCreateTraceRequestBlocking,
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        name: mockCreateTraceRequestBlocking.name,
      });
      expect(['completed', 'failed']).toContain(responseData.data.status);
    });

    it('should return 401 for invalid authentication', async () => {
      const request = createMockRequest('http://localhost:3000/api/traces', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-key',
          'Content-Type': 'application/json',
        },
        body: mockCreateTraceRequest,
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Unauthorized');
    });

    it('should return 400 for invalid request body', async () => {
      const invalidRequest = {
        name: '', // Invalid: empty name
        input: 'Valid input',
      };

      const request = createMockRequest('http://localhost:3000/api/traces', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: invalidRequest,
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Validation error');
      expect(responseData.details).toContain('name');
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteRequest = {
        input: 'Valid input',
        // Missing name field
      };

      const request = createMockRequest('http://localhost:3000/api/traces', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: incompleteRequest,
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Validation error');
      expect(responseData.details).toContain('name');
    });
  });

  describe('GET /api/traces', () => {
    it('should list traces with default pagination', async () => {
      const request = createMockRequest('http://localhost:3000/api/traces', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.traces).toHaveLength(3);
      expect(responseData.data.pagination).toMatchObject({
        cursor: null,
        orderBy: 'createdAt',
        orderDirection: 'desc',
      });
    });

    it('should list traces with custom pagination parameters', async () => {
      const request = createMockRequest('http://localhost:3000/api/traces?limit=2&orderBy=name&orderDirection=asc', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.traces).toHaveLength(2);
      expect(responseData.data.pagination).toMatchObject({
        orderBy: 'name',
        orderDirection: 'asc',
      });
    });

    it('should list traces with field selection', async () => {
      const request = createMockRequest('http://localhost:3000/api/traces?fields=id,name,status', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.traces).toHaveLength(3);
      
      // Check that only requested fields are present
      responseData.data.traces.forEach((trace: Record<string, unknown>) => {
        expect(Object.keys(trace)).toEqual(expect.arrayContaining(['id', 'name', 'status']));
        expect(trace).not.toHaveProperty('initialInput');
        expect(trace).not.toHaveProperty('events');
      });
    });

    it('should handle cursor pagination', async () => {
      // First request to get a cursor
      const firstRequest = createMockRequest('http://localhost:3000/api/traces?limit=1', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const firstResponse = await GET(firstRequest);
      const firstData = await firstResponse.json();
      
      expect(firstData.data.traces).toHaveLength(1);
      const firstTraceId = firstData.data.traces[0].id;

      // Second request with cursor
      const secondRequest = createMockRequest(`http://localhost:3000/api/traces?limit=1&cursor=${firstTraceId}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const secondResponse = await GET(secondRequest);
      const secondData = await secondResponse.json();

      expect(secondResponse.status).toBe(200);
      expect(secondData.data.traces).toHaveLength(1);
      expect(secondData.data.traces[0].id).not.toBe(firstTraceId);
    });

    it('should return 401 for invalid authentication', async () => {
      const request = createMockRequest('http://localhost:3000/api/traces', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-key',
        },
      });

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Unauthorized');
    });

    it('should return 400 for invalid pagination parameters', async () => {
      const request = createMockRequest('http://localhost:3000/api/traces?limit=150', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-api-key',
        },
      });

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Validation error');
      expect(responseData.details).toContain('limit');
    });
  });
});