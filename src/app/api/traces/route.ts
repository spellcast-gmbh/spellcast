import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { agenticTraceService } from '@/lib/firebase';
import { AgentProcessor } from '@/lib/agentProcessor';
import { 
  ListTracesRequestSchema,
  AgentTypeSchema
} from '@/models/agenticTraceSchemas';
import { z } from 'zod';

// Schema for prompt submission
const SubmitPromptSchema = z.object({
  name: z.string().min(1).max(255),
  prompt: z.string().min(1),
  agentHint: AgentTypeSchema.optional(),
  blocking: z.boolean().default(false),
});

/**
 * POST /api/traces - Submit a prompt to create a new trace
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
    const validatedData = SubmitPromptSchema.parse(body);

    // Create the trace in pending status
    const trace = await agenticTraceService.createTrace({
      name: validatedData.name,
      initialInput: validatedData.prompt,
      events: [],
      status: 'pending',
      agentHint: validatedData.agentHint,
    });

    if (validatedData.blocking) {
      // Process synchronously and wait for completion
      await AgentProcessor.processTraceBlocking(trace.id);
      
      // Get the updated trace with processing results
      const completedTrace = await agenticTraceService.getTrace(trace.id);
      
      return NextResponse.json({
        success: true,
        data: completedTrace
      }, { status: 201 });
    } else {
      // Start agent processing asynchronously (fire and forget)
      AgentProcessor.startProcessing(trace.id);

      // Return the trace ID immediately
      return NextResponse.json({
        success: true,
        data: {
          id: trace.id,
          name: trace.name,
          status: trace.status,
          createdAt: trace.createdAt
        }
      }, { status: 201 });
    }

  } catch (error) {
    console.error('Error submitting prompt:', error);

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