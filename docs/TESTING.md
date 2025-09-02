# Testing Guide

This project includes comprehensive tests for all API endpoints using Jest and Supertest.

## Test Structure

```
__tests__/
├── api/
│   └── linear/          # API endpoint tests
│       ├── create.test.ts
│       ├── [id].test.ts
│       ├── search.test.ts
│       └── list.test.ts
├── lib/
│   └── auth.test.ts     # Authentication utility tests
├── models/
│   └── issueSchemas.test.ts  # Yup schema tests
├── middleware.test.ts   # Middleware tests
└── helpers/
    └── testUtils.ts     # Test utilities and mocks
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/api/linear/create.test.ts
```

## Test Categories

### 1. **API Route Tests**
- Test all HTTP methods (GET, POST, PUT)
- Validate request/response formats
- Test error handling
- Mock Linear SDK calls

### 2. **Authentication Tests**
- API key validation (Bearer token and query parameter)
- Unauthorized access handling
- Environment variable validation

### 3. **Middleware Tests**
- Route protection
- Request filtering
- Error responses

### 4. **Schema Validation Tests**
- Yup schema validation
- Input sanitization
- Error message validation

## Mocking Strategy

### Linear SDK Mocking
The tests use Jest mocks to simulate Linear API responses:

```typescript
// Mock setup
const mockCreateIssue = jest.fn();

jest.doMock('../../../src/lib/linear', () => ({
  linearClient: {
    createIssue: mockCreateIssue,
  },
}));

// Test usage
mockCreateIssue.mockResolvedValue(mockResponse);
```

### Test Data
All test utilities and mock data are centralized in `__tests__/helpers/testUtils.ts`:

- `createMockRequest()` - Creates NextRequest objects for testing
- `mockLinearIssue` - Sample Linear issue data
- `mockLinearCreateResponse` - Mock create/update responses

## Test Coverage

The test suite covers:

✅ **Authentication & Authorization**
- API key validation (Bearer token & query param)
- Unauthorized access handling
- Environment variable validation

✅ **API Endpoints**
- `POST /api/linear/create` - Issue creation
- `GET /api/linear/[id]` - Issue retrieval
- `PUT /api/linear/[id]` - Issue updates
- `GET /api/linear/search` - Issue searching with filters
- `GET /api/linear/list` - Issue listing with pagination

✅ **Input Validation**
- Yup schema validation
- Required field validation
- Data type validation
- Input sanitization

✅ **Error Handling**
- Linear API errors
- Validation errors
- Network errors
- Malformed requests

✅ **Edge Cases**
- Empty responses
- Null values
- Invalid parameters
- Boundary conditions

## Writing New Tests

When adding new API endpoints:

1. Create test file in appropriate directory
2. Set up mocks for external dependencies
3. Test happy path scenarios
4. Test error conditions
5. Test edge cases
6. Ensure proper cleanup in `beforeEach`

Example test structure:
```typescript
describe('API Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle valid requests', async () => {
    // Arrange
    const mockData = { /* test data */ };
    mockFunction.mockResolvedValue(mockResponse);

    // Act
    const response = await apiFunction(mockRequest);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockFunction).toHaveBeenCalledWith(mockData);
  });

  it('should handle errors gracefully', async () => {
    // Test error scenarios
  });
});
```
