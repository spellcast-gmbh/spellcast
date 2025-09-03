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

      await agenticTraceService.updateTrace(traceId, {
        status: 'running'
      });

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
}