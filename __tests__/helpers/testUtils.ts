import { NextRequest } from 'next/server';

/**
 * Create a mock NextRequest for testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body } = options;
  
  const request = new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  return request;
}

/**
 * Mock Linear issue object
 */
export const mockLinearIssue = {
  id: 'test-issue-id',
  title: 'Test Issue',
  description: 'Test issue description',
  number: 123,
  url: 'https://linear.app/test/issue/TST-123',
  priority: 2,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  state: Promise.resolve({ name: 'In Progress' }),
  assignee: Promise.resolve({ name: 'Test User' }),
  team: Promise.resolve({ name: 'Test Team' }),
  labels: Promise.resolve({ nodes: [] }),
  project: Promise.resolve(null),
};

/**
 * Mock Linear issues list response
 */
export const mockLinearIssuesResponse = {
  nodes: [mockLinearIssue],
  pageInfo: {
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

/**
 * Mock Linear create/update response
 */
export const mockLinearCreateResponse = {
  issue: Promise.resolve(mockLinearIssue),
  success: true,
};
