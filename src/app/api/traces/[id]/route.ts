import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { agenticTraceService } from '@/lib/firebase';
import { GetTraceRequestSchema } from '@/models/agenticTraceSchemas';
import { z } from 'zod';

// Schema for updating trace status
const UpdateTraceRequestSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  duration: z.number().min(0).optional(),
});

// Schema for adding events to traces
const AddEventRequestSchema = z.object({
  event: z.object({
    type: z.enum(['tool', 'start', 'handoff']).default('tool'),
    agent: z.enum(['coordinator', 'linear', 'hosting']),
    input: z.record(z.unknown()),
    output: z.record(z.unknown()),
    markdown: z.string().optional(),
    timestamp: z.string(),
  }),
});

/**
 * GET /api/traces/[id] - Get a specific trace by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate authentication
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid or missing API key' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const { searchParams } = new URL(request.url);
    
    // Extract and validate parameters
    const queryData = {
      id: resolvedParams.id,
      fields: searchParams.get('fields') || undefined,
    };

    // Remove undefined values
    const cleanData = Object.fromEntries(
      Object.entries(queryData).filter(([, v]) => v !== undefined)
    );

    // Validate query parameters first (this will catch invalid UUID format)
    const validatedData = GetTraceRequestSchema.parse(cleanData);

    // Get trace from Firebase
    const trace = await agenticTraceService.getTrace(validatedData.id);

    if (!trace) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Trace not found' 
        },
        { status: 404 }
      );
    }

    // Apply field projection if specified
    let responseData: unknown = trace;
    if (validatedData.fields) {
      const fields = validatedData.fields.split(',').map(f => f.trim());
      const projected: Record<string, unknown> = { id: trace.id }; // Always include id
      
      fields.forEach(field => {
        if (field in trace) {
          projected[field] = (trace as Record<string, unknown>)[field];
        }
      });
      
      responseData = projected;
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error getting trace:', error);

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
 * PUT /api/traces/[id] - Update a trace
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate authentication
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid or missing API key' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const body = await request.json();
    
    // Validate ID format first
    GetTraceRequestSchema.parse({ id: resolvedParams.id });
    
    // Check if this is an event addition request
    if (body.event) {
      const eventRequest = AddEventRequestSchema.parse(body);
      
      // Check if trace exists first
      const existingTrace = await agenticTraceService.getTrace(resolvedParams.id);
      if (!existingTrace) {
        return NextResponse.json(
          { success: false, error: 'Trace not found' },
          { status: 404 }
        );
      }

      // Add event to trace
      await agenticTraceService.addEventToTrace(resolvedParams.id, eventRequest.event);
      
      // Get updated trace
      const updatedTrace = await agenticTraceService.getTrace(resolvedParams.id);

      return NextResponse.json({
        success: true,
        data: updatedTrace
      });
    }
    
    // Otherwise, validate as trace update
    const updateData = UpdateTraceRequestSchema.parse(body);
    
    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Check if trace exists first
    const existingTrace = await agenticTraceService.getTrace(resolvedParams.id);
    if (!existingTrace) {
      return NextResponse.json(
        { success: false, error: 'Trace not found' },
        { status: 404 }
      );
    }

    // Update trace
    await agenticTraceService.updateTrace(resolvedParams.id, updateData);
    
    // Get updated trace
    const updatedTrace = await agenticTraceService.getTrace(resolvedParams.id);

    return NextResponse.json({
      success: true,
      data: updatedTrace
    });

  } catch (error) {
    console.error('Error updating trace:', error);

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

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/traces/[id] - Delete a trace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate authentication
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid or missing API key' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    
    // Check if trace exists first
    const existingTrace = await agenticTraceService.getTrace(resolvedParams.id);
    if (!existingTrace) {
      return NextResponse.json(
        { success: false, error: 'Trace not found' },
        { status: 404 }
      );
    }
    
    // Delete trace
    await agenticTraceService.deleteTrace(resolvedParams.id);

    return NextResponse.json({
      success: true,
      data: { message: 'Trace deleted successfully' }
    });

  } catch (error) {
    console.error('Error deleting trace:', error);

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

