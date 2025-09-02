import { AgentEvent } from '../models/agenticTraceSchemas';
import { agenticTraceService } from './firebase';

/**
 * Service for managing trace events and handoff logging
 * This service integrates handoff events into the existing trace system
 */
export class TraceService {
  /**
   * Add a handoff event to a trace
   * This should be called when a handoff occurs to log it properly
   */
  static async addHandoffEvent(traceId: string, event: AgentEvent): Promise<void> {
    try {
      // Get the existing trace
      const trace = await agenticTraceService.getTrace(traceId);
      if (!trace) {
        console.error(`Trace ${traceId} not found when adding handoff event`);
        return;
      }

      // Add the event to the trace
      const updatedEvents = [...trace.events, event];
      
      await agenticTraceService.updateTrace(traceId, {
        events: updatedEvents,
        updatedAt: new Date().toISOString()
      });

      console.log(`Added handoff event ${event.id} to trace ${traceId}`);
    } catch (error) {
      console.error(`Failed to add handoff event to trace ${traceId}:`, error);
    }
  }

  /**
   * Add multiple handoff events to a trace (e.g., handoff + received events)
   */
  static async addHandoffEvents(traceId: string, events: AgentEvent[]): Promise<void> {
    try {
      // Get the existing trace
      const trace = await agenticTraceService.getTrace(traceId);
      if (!trace) {
        console.error(`Trace ${traceId} not found when adding handoff events`);
        return;
      }

      // Add all events to the trace
      const updatedEvents = [...trace.events, ...events];
      
      await agenticTraceService.updateTrace(traceId, {
        events: updatedEvents,
        updatedAt: new Date().toISOString()
      });

      console.log(`Added ${events.length} handoff events to trace ${traceId}`);
    } catch (error) {
      console.error(`Failed to add handoff events to trace ${traceId}:`, error);
    }
  }

  /**
   * Helper method to add both handoff and received events from a handoff pair
   */
  static async logHandoffPair(
    traceId: string, 
    handoffPair: { handoffEvent: AgentEvent; receivedEvent: AgentEvent }
  ): Promise<void> {
    await this.addHandoffEvents(traceId, [handoffPair.handoffEvent, handoffPair.receivedEvent]);
  }
}

// Export for easy use
export const traceService = TraceService;