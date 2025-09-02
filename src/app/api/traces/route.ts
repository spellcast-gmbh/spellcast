import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { agenticTraceService } from '@/lib/firebase';
import { 
  CreateTraceRequestSchema, 
  ListTracesRequestSchema
} from '@/models/agenticTraceSchemas';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

/**
 * POST /api/traces - Create a new agentic trace
 */
export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid or missing API key' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validatedData = CreateTraceRequestSchema.parse(body);

    // Create the trace
    const trace = await agenticTraceService.createTrace({
      name: validatedData.name,
      initialInput: validatedData.input,
      events: [],
      status: validatedData.blocking ? 'pending' : 'running',
      metadata: validatedData.metadata,
    });

    // If blocking mode, simulate processing and return completed trace
    if (validatedData.blocking) {
      // In a real implementation, you would run the actual agent processing here
      // For now, we'll create a mock completed trace with a sample event
      const mockEvent = {
        id: uuidv4(),
        input: validatedData.input,
        agentType: validatedData.firstAgent || 'planner' as const,
        timestamp: new Date().toISOString(),
        duration: 1000,
        outcome: {
          success: true,
          result: 'Processing completed',
          type: 'completion'
        },
        markdown: `## Processing Result\n\nProcessed input: "${validatedData.input}"\n\nAgent: ${validatedData.firstAgent || 'planner'}`,
        handovers: [],
        metadata: {}
      };

      // Update trace with the completed event and final status
      await agenticTraceService.updateTrace(trace.id, {
        events: [mockEvent],
        status: 'completed',
        duration: 1000
      });

      // Return the completed trace
      const completedTrace = await agenticTraceService.getTrace(trace.id);
      
      return NextResponse.json({
        success: true,
        data: completedTrace
      }, { status: 201 });
    }

    // For non-blocking mode, return the initial trace
    return NextResponse.json({
      success: true,
      data: trace
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating trace:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation error',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }

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

/**
 * GET /api/traces - List traces with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid or missing API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Extract and validate query parameters
    const queryParams = {
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      orderBy: searchParams.get('orderBy') || undefined,
      orderDirection: searchParams.get('orderDirection') || undefined,
      fields: searchParams.get('fields') || undefined,
    };

    // Remove undefined values
    const cleanParams = Object.fromEntries(
      Object.entries(queryParams).filter(([, v]) => v !== undefined)
    );

    const validatedParams = ListTracesRequestSchema.parse(cleanParams);

    // Parse fields if provided
    const fields = validatedParams.fields ? validatedParams.fields.split(',').map(f => f.trim()) : undefined;

    // Get traces from Firebase
    const result = await agenticTraceService.listTraces({
      cursor: validatedParams.cursor,
      limit: validatedParams.limit,
      orderBy: validatedParams.orderBy,
      orderDirection: validatedParams.orderDirection,
      fields,
    });

    return NextResponse.json({
      success: true,
      data: {
        traces: result.traces,
        pagination: {
          cursor: validatedParams.cursor || null,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          orderBy: validatedParams.orderBy,
          orderDirection: validatedParams.orderDirection,
        }
      }
    });

  } catch (error) {
    console.error('Error listing traces:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation error',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }

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