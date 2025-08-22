import { NextRequest, NextResponse } from 'next/server';
import { linearClient, LinearEntityResolver } from '@/lib/linear';
import { searchIssuesSchema, SearchIssuesPayload } from '@/models/issueSchemas';

interface IssueFilter {
  team?: { id: { eq: string } };
  assignee?: { id: { eq: string } };
  state?: { id: { eq: string } };
  project?: { id: { eq: string } };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const queryData = {
      query: searchParams.get('query') || undefined,
      teamId: searchParams.get('teamId') || undefined,
      assigneeId: searchParams.get('assigneeId') || undefined,
      stateId: searchParams.get('stateId') || undefined,
      projectId: searchParams.get('projectId') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };

    // Validate query parameters
    const validatedData = await searchIssuesSchema.validate(queryData) as SearchIssuesPayload;

    // Resolve entity names to IDs
    const [team, assignee, project, state] = await Promise.all([
      validatedData.teamId ? LinearEntityResolver.resolveTeam(validatedData.teamId) : null,
      validatedData.assigneeId ? LinearEntityResolver.resolveUser(validatedData.assigneeId) : null,
      validatedData.projectId ? LinearEntityResolver.resolveProject(validatedData.projectId) : null,
      validatedData.stateId ? LinearEntityResolver.resolveState(validatedData.stateId) : null,
    ]);

    // Check if specified entities were found
    if (validatedData.teamId && !team) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Team '${validatedData.teamId}' not found` 
        },
        { status: 400 }
      );
    }

    if (validatedData.assigneeId && !assignee) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Assignee '${validatedData.assigneeId}' not found` 
        },
        { status: 400 }
      );
    }

    if (validatedData.projectId && !project) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Project '${validatedData.projectId}' not found` 
        },
        { status: 400 }
      );
    }

    if (validatedData.stateId && !state) {
      return NextResponse.json(
        { 
          success: false, 
          error: `State '${validatedData.stateId}' not found` 
        },
        { status: 400 }
      );
    }

    // Build filter object for Linear API using resolved IDs
    const filter: IssueFilter = {};
    
    if (team) {
      filter.team = { id: { eq: team.id } };
    }
    
    if (assignee) {
      filter.assignee = { id: { eq: assignee.id } };
    }
    
    if (state) {
      filter.state = { id: { eq: state.id } };
    }
    
    if (project) {
      filter.project = { id: { eq: project.id } };
    }

    // Search for issues
    const issues = await linearClient.issues({
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      first: validatedData.limit || 50,
      after: validatedData.offset ? String(validatedData.offset) : undefined,
    });

    // If there's a text query, filter results by title/description
    let filteredIssues = issues.nodes;
    if (validatedData.query) {
      const queryLower = validatedData.query.toLowerCase();
      filteredIssues = issues.nodes.filter(issue => 
        issue.title.toLowerCase().includes(queryLower) ||
        (issue.description && issue.description.toLowerCase().includes(queryLower))
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        issues: filteredIssues.map(issue => ({
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
        // Include the resolved filter information for reference
        appliedFilters: {
          team: team ? { id: team.id, name: team.name, key: team.key } : null,
          assignee: assignee ? { 
            id: assignee.id, 
            name: assignee.name, 
            displayName: assignee.displayName,
            email: assignee.email 
          } : null,
          project: project ? { id: project.id, name: project.name } : null,
          state: state ? { 
            id: state.id, 
            name: state.name, 
            type: state.type, 
            color: state.color 
          } : null,
          query: validatedData.query || null,
        },
      },
    });
  } catch (error) {
    console.error('Error searching issues:', error);
    
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
