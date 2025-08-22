import { NextRequest } from 'next/server';

/**
 * Validates API key from Authorization header (Bearer token)
 * @param request - Next.js request object
 * @returns boolean - true if authentication is valid
 */
export function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.error('API_KEY environment variable is not set');
    return false;
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (token === apiKey) {
      return true;
    }
  }

  return false;
}

/**
 * Creates an unauthorized response
 */
export function createUnauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: 'Unauthorized - Invalid or missing API key' }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
