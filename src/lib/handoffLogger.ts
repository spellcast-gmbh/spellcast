import { v4 as uuidv4 } from 'uuid';
import { AgentEvent, AgentType } from '../models/agenticTraceSchemas';

interface HandoffLogData {
  traceId: string;
  fromAgent: AgentType;
  toAgent: AgentType;
  input: string;
  context?: string;
  task?: string;
}

export class HandoffLogger {
  /**
   * Creates an AgentEvent for a handoff operation
   * This event represents the handoff action itself
   */
  static createHandoffEvent(data: HandoffLogData): AgentEvent {
    const now = new Date().toISOString();

    const event: AgentEvent = {
      id: uuidv4(),
      type: 'handoff',
      agent: data.fromAgent,
      input: {
        task: data.task || data.input,
        context: data.context,
        targetAgent: data.toAgent
      },
      output: {
        handoffExecuted: true,
        targetAgent: data.toAgent,
        task: data.task,
        context: data.context
      },
      markdown: this.generateHandoffMarkdown(data),
      timestamp: now
    };

    return event;
  }

  /**
   * Creates a markdown description for the handoff event
   */
  private static generateHandoffMarkdown(data: HandoffLogData): string {
    const taskInfo = data.task ? ` for task: "${data.task}"` : '';
    const contextInfo = data.context ? `\n\n**Context:** ${data.context}` : '';
    
    return `🔄 **Agent Handoff**
    
**From:** ${data.fromAgent} Agent
**To:** ${data.toAgent} Agent${taskInfo}
**Input:** ${data.input}${contextInfo}

The ${data.fromAgent} agent is transferring control to the ${data.toAgent} agent to handle this request.`;
  }

  /**
   * Creates an AgentEvent for when an agent receives a handoff
   * This represents the receiving agent starting to process the handed-off task
   */
  static createHandoffReceivedEvent(data: {
    traceId: string;
    agent: AgentType;
    input: string;
    handoffId: string;
    fromAgent: AgentType;
  }): AgentEvent {
    const now = new Date().toISOString();

    const event: AgentEvent = {
      id: uuidv4(),
      type: 'start',
      agent: data.agent,
      input: {
        receivedFrom: data.fromAgent,
        handoffId: data.handoffId,
        task: data.input
      },
      output: {
        handoffReceived: true,
        fromAgent: data.fromAgent,
        handoffId: data.handoffId,
        processingStarted: true
      },
      markdown: `📥 **Handoff Received**

**From:** ${data.fromAgent} Agent
**Processing:** ${data.input}

The ${data.agent} agent has received the handoff and is now processing the request.`,
      timestamp: now
    };

    return event;
  }

  /**
   * Helper method to log a complete handoff interaction
   * Returns both the handoff event and the received event
   */
  static createHandoffEventPair(data: HandoffLogData): {
    handoffEvent: AgentEvent;
    receivedEvent: AgentEvent;
  } {
    const handoffEvent = this.createHandoffEvent(data);
    const handoffId = handoffEvent.id;
    
    const receivedEvent = this.createHandoffReceivedEvent({
      traceId: data.traceId,
      agent: data.toAgent,
      input: data.input,
      handoffId,
      fromAgent: data.fromAgent
    });

    return { handoffEvent, receivedEvent };
  }
}

// Export utility function for easy use
export function logHandoff(data: HandoffLogData): {
  handoffEvent: AgentEvent;
  receivedEvent: AgentEvent;
} {
  return HandoffLogger.createHandoffEventPair(data);
}