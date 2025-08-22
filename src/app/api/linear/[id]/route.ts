import { NextRequest, NextResponse } from 'next/server';
import { linearClient, LinearEntityResolver } from '@/lib/linear';
import { updateIssueSchema, UpdateIssuePayload } from '@/models/issueSchemas';

// GET /api/linear/[id] - Get issue by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Issue ID is required' 
        },
        { status: 400 }
      );
    }

    const issue = await linearClient.issue(id);

    if (!issue) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Issue not found' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        number: issue.number,
        url: issue.url,
        priority: issue.priority,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching issue:', error);
    
    if (error instanceof Error) {
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

// PUT /api/linear/[id] - Update issue by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Issue ID is required' 
        },
        { status: 400 }
      );
    }

    // Validate request body
    const validatedData = await updateIssueSchema.validate(body) as UpdateIssuePayload;

    // Resolve entity names to IDs (only resolve if provided)
    const [assignee, project, state] = await Promise.all([
      validatedData.assigneeId ? LinearEntityResolver.resolveUser(validatedData.assigneeId) : null,
      validatedData.projectId ? LinearEntityResolver.resolveProject(validatedData.projectId) : null,
      validatedData.stateId ? LinearEntityResolver.resolveState(validatedData.stateId) : null,
    ]);

    // Check if specified entities were found
    if (validatedData.assigneeId && !assignee) {
      const errorMessage = await LinearEntityResolver.createResolutionError('user', validatedData.assigneeId);
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage
        },
        { status: 400 }
      );
    }

    if (validatedData.projectId && !project) {
      const errorMessage = await LinearEntityResolver.createResolutionError('project', validatedData.projectId);
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage
        },
        { status: 400 }
      );
    }

    if (validatedData.stateId && !state) {
      const errorMessage = await LinearEntityResolver.createResolutionError('state', validatedData.stateId);
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage
        },
        { status: 400 }
      );
    }

    // Update issue using Linear SDK with resolved IDs
    const updatePayload = await linearClient.updateIssue(id, {
      title: validatedData.title,
      description: validatedData.description,
      assigneeId: assignee?.id || validatedData.assigneeId,
      priority: validatedData.priority,
      labelIds: validatedData.labelIds,
      projectId: project?.id || validatedData.projectId,
      stateId: state?.id || validatedData.stateId,
    });

    const issue = await updatePayload.issue;

    if (!issue) {
      throw new Error('Failed to update issue');
    }

    return NextResponse.json({
      success: true,
      data: {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        number: issue.number,
        url: issue.url,
        priority: issue.priority,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating issue:', error);
    
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