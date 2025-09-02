import { agenticTraceService } from './firebase';
import coordinator from '@/agents/coordinator';
import { run } from '@openai/agents';

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
      // Get the trace to access the initial input
      const trace = await agenticTraceService.getTrace(traceId);
      if (!trace) {
        throw new Error('Trace not found');
      }

      console.log(`Starting agent processing for trace ${traceId}:`, trace.initialInput);

      // Run the coordinator agent with the input
      const input = trace.initialInput + "\n\n If possible, use the agent " + trace.agentHint;
      await run(coordinator(trace), input);
      
      const duration = Date.now() - startTime;

      // Update trace with the event and completion status
      await agenticTraceService.updateTrace(traceId, {
        status: 'completed',
        duration
      });

      console.log(`Agent processing completed for trace ${traceId} in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Error processing trace ${traceId}:`, error);

      // Update trace with error status
      await agenticTraceService.updateTrace(traceId, {
        status: 'failed',
        duration
      });
    }
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