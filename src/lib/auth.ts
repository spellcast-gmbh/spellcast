import { NextRequest } from 'next/server';
import { env } from './env';

/**
 * Validates API key from Authorization header (Bearer token)
 * @param request - Next.js request object
 * @returns boolean - true if authentication is valid
 */
export function validateApiKey(request: NextRequest): boolean {
  try {
    // Check Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      if (token === env.API_KEY) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
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
