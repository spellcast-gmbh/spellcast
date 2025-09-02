import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { agenticTraceService } from '@/lib/firebase';
import { GetTraceRequestSchema } from '@/models/agenticTraceSchemas';
import { z } from 'zod';

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
 * PUT /api/traces/[id] - Update a trace (add events)
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

    // Validate trace exists
    const existingTrace = await agenticTraceService.getTrace(resolvedParams.id);
    if (!existingTrace) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Trace not found' 
        },
        { status: 404 }
      );
    }

    // Validate request body for adding events
    if (body.event) {
      // Add a single event to the trace
      await agenticTraceService.addEventToTrace(resolvedParams.id, body.event);
      
      // Get the updated trace
      const updatedTrace = await agenticTraceService.getTrace(resolvedParams.id);
      
      return NextResponse.json({
        success: true,
        data: updatedTrace
      });
    } else {
      // General trace updates (status, metadata, etc.)
      const allowedUpdates = ['status', 'metadata', 'duration'];
      const updates: Record<string, unknown> = {};
      
      for (const key of allowedUpdates) {
        if (key in body) {
          updates[key] = body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'No valid fields to update' 
          },
          { status: 400 }
        );
      }

      await agenticTraceService.updateTrace(resolvedParams.id, updates);
      
      // Get the updated trace
      const updatedTrace = await agenticTraceService.getTrace(resolvedParams.id);
      
      return NextResponse.json({
        success: true,
        data: updatedTrace
      });
    }

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

    // Validate trace exists
    const existingTrace = await agenticTraceService.getTrace(resolvedParams.id);
    if (!existingTrace) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Trace not found' 
        },
        { status: 404 }
      );
    }

    // Delete the trace
    await agenticTraceService.deleteTrace(resolvedParams.id);

    return NextResponse.json({
      success: true,
      data: { message: 'Trace deleted successfully' }
    });

  } catch (error) {
    console.error('Error deleting trace:', error);

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