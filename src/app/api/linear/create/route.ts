import { NextRequest, NextResponse } from 'next/server';
import { linearClient, LinearEntityResolver } from '@/lib/linear';
import { createIssueSchema, CreateIssuePayload } from '@/models/issueSchemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = await createIssueSchema.validate(body) as CreateIssuePayload;

    // Resolve entity names to IDs
    const [team, assignee, project, state] = await Promise.all([
      LinearEntityResolver.resolveTeam(validatedData.teamId),
      validatedData.assigneeId ? LinearEntityResolver.resolveUser(validatedData.assigneeId) : null,
      validatedData.projectId ? LinearEntityResolver.resolveProject(validatedData.projectId) : LinearEntityResolver.resolveDefaultProject(),
      validatedData.stateId ? LinearEntityResolver.resolveState(validatedData.stateId) : null,
    ]);

    // Check if team was found
    if (!team) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Team '${validatedData.teamId}' not found` 
        },
        { status: 400 }
      );
    }

    // Check if assignee was specified but not found
    if (validatedData.assigneeId && !assignee) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Assignee '${validatedData.assigneeId}' not found` 
        },
        { status: 400 }
      );
    }

    // Check if project was specified but not found
    if (validatedData.projectId && !project) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Project '${validatedData.projectId}' not found` 
        },
        { status: 400 }
      );
    }

    // Check if state was specified but not found
    if (validatedData.stateId && !state) {
      return NextResponse.json(
        { 
          success: false, 
          error: `State '${validatedData.stateId}' not found` 
        },
        { status: 400 }
      );
    }

    // Create issue using Linear SDK with resolved IDs
    const issuePayload = await linearClient.createIssue({
      title: validatedData.title,
      description: validatedData.description,
      teamId: team.id,
      assigneeId: assignee?.id,
      priority: validatedData.priority,
      labelIds: validatedData.labelIds,
      projectId: project?.id,
      stateId: state?.id,
    });

    const issue = await issuePayload.issue;

    if (!issue) {
      throw new Error('Failed to create issue');
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
        // Include resolved entity information
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
      },
    });
  } catch (error) {
    console.error('Error creating issue:', error);
    
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
