import { agenticTraceService } from './firebase';
import coordinator from '@/agents/coordinator';
import { run } from '@openai/agents';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessingResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export class AgentProcessor {
  /**
   * Process a trace with the coordinator agent
   */
  static async processTrace(traceId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update trace status to running
      await agenticTraceService.updateTrace(traceId, {
        status: 'running'
      });

      // Get the trace to access the initial input
      const trace = await agenticTraceService.getTrace(traceId);
      if (!trace) {
        throw new Error('Trace not found');
      }

      console.log(`Starting agent processing for trace ${traceId}:`, trace.initialInput);

      // Run the coordinator agent with the input
      const agentResult = await this.runCoordinator(trace.initialInput + "\n\n If possible, use the agent " + trace.agentHint);
      
      const duration = Date.now() - startTime;

      // Create an event for the coordinator's work
      const coordinatorEvent = {
        id: uuidv4(),
        input: trace.initialInput,
        agentType: 'coordinator' as const,
        timestamp: new Date().toISOString(),
        duration,
        outcome: {
          success: agentResult.success,
          result: agentResult.result,
          type: agentResult.success ? 'completion' : 'error'
        },
        markdown: this.generateEventMarkdown(trace.initialInput, agentResult),
        handoffs: [],
        agentHint: 'coordinator' as const
      };

      // Update trace with the event and completion status
      await agenticTraceService.updateTrace(traceId, {
        events: [coordinatorEvent],
        status: agentResult.success ? 'completed' : 'failed',
        duration
      });

      console.log(`Agent processing completed for trace ${traceId} in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Error processing trace ${traceId}:`, error);

      // Create error event
      const errorEvent = {
        id: uuidv4(),
        input: '',
        agentType: 'coordinator' as const,
        timestamp: new Date().toISOString(),
        duration,
        outcome: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'error'
        },
        markdown: `## Processing Error\n\nAn error occurred while processing the request:\n\n\`\`\`\n${error instanceof Error ? error.message : 'Unknown error'}\n\`\`\``,
        handoffs: [],
        agentHint: 'coordinator' as const
      };

      // Update trace with error status
      await agenticTraceService.updateTrace(traceId, {
        events: [errorEvent],
        status: 'failed',
        duration
      });
    }
  }

  /**
   * Run the coordinator agent with the given input
   */
  private static async runCoordinator(input: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Run the coordinator agent
      const result = await run(coordinator, input);

      const duration = Date.now() - startTime;

      return {
        success: true,
        result: result.output || 'No response from coordinator',
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Coordinator agent error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown coordinator error',
        duration
      };
    }
  }

  /**
   * Generate markdown documentation for the event
   */
  private static generateEventMarkdown(input: string, result: ProcessingResult): string {
    if (!result.success) {
      return `## Coordinator Processing - Failed

**Input:** ${input}

**Error:** ${result.error}

**Duration:** ${result.duration}ms`;
    }

    return `## Coordinator Processing - Completed

**Input:** ${input}

**Response:**
${result.result}

**Duration:** ${result.duration}ms

**Status:** ✅ Completed successfully`;
  }

  /**
   * Start processing a trace asynchronously (fire and forget)
   */
  static startProcessing(traceId: string): void {
    // Process the trace asynchronously without awaiting
    this.processTrace(traceId).catch(error => {
      console.error(`Failed to process trace ${traceId}:`, error);
    });
  }

  /**
   * Process a trace synchronously and wait for completion
   */
  static async processTraceBlocking(traceId: string): Promise<void> {
    return this.processTrace(traceId);
  }

  /**
   * Check if a trace is complete (finished processing)
   */
  static async isTraceComplete(traceId: string): Promise<boolean> {
    const trace = await agenticTraceService.getTrace(traceId);
    return trace ? ['completed', 'failed'].includes(trace.status) : false;
  }

  /**
   * Wait for trace completion with timeout
   */
  static async waitForCompletion(traceId: string, timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isTraceComplete(traceId)) {
        return true;
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false; // Timeout reached
  }
}