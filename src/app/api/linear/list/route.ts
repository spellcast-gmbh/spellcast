import { NextRequest, NextResponse } from 'next/server';
import { linearClient, LinearEntityResolver } from '@/lib/linear';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    const teamId = searchParams.get('teamId') || undefined;

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Limit must be between 1 and 100' 
        },
        { status: 400 }
      );
    }

    // Validate offset
    if (offset < 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Offset must be non-negative' 
        },
        { status: 400 }
      );
    }

    // Resolve team if provided
    const team = teamId ? await LinearEntityResolver.resolveTeam(teamId) : null;

    // Check if team was specified but not found
    if (teamId && !team) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Team '${teamId}' not found` 
        },
        { status: 400 }
      );
    }

    // Build filter for team if provided
    const filter = team ? { team: { id: { eq: team.id } } } : undefined;

    // Get issues from Linear
    const issues = await linearClient.issues({
      filter,
      first: limit,
      after: offset > 0 ? String(offset) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        issues: issues.nodes.map(issue => ({
          id: issue.id,
          title: issue.title,
          description: issue.description,
          number: issue.number,
          url: issue.url,
          priority: issue.priority,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
        })),
        totalCount: issues.nodes.length,
        hasNextPage: issues.pageInfo.hasNextPage,
        hasPreviousPage: issues.pageInfo.hasPreviousPage,
        pagination: {
          limit,
          offset,
        },
      },
    });
  } catch (error) {
    console.error('Error listing issues:', error);
    
    if (error instanceof Error) {
      // Handle Yup validation errors with clean messages
      if (error.name === 'ValidationError') {
        return NextResponse.json(
          { 
            success: false, 
            error: `Validation error: ${error.message}` 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: error.message 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
