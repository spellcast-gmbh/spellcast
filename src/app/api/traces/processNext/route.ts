import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { ListTracesRequestSchema } from "@/models/agenticTraceSchemas";
import { agenticTraceService } from "@/lib/firebase";
import { z } from "zod";
import { AgentProcessor } from "@/lib/agentProcessor";

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
  
      // Parse URL for potential future use
      new URL(request.url);
      
      // Extract and validate query parameters
      const queryParams = {
        limit: 1,
        orderBy: 'createdAt',
        orderDirection: 'asc',
        fields: 'id,status',
        onlyPending: true,
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

      if (result.traces.length === 0 || result.traces[0].status !== 'pending') {
        return NextResponse.json({
          message: 'No unprocessed traces found',
          success: true,
          data: null
        });
      }

      const trace = result.traces[0];

      await AgentProcessor.processTrace(trace.id!);

      const completedTrace = await agenticTraceService.getTrace(trace.id!);
  
      return NextResponse.json({
        success: true,
        data: completedTrace,
        message: 'Trace processed completed'
      });
  
    } catch (error) {
      console.error('Error processing next trace:', error);
  
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