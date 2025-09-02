import { Agent, handoff } from '@openai/agents';
import { z } from 'zod';
import linearAgent from './linear-agent';
import { logHandoff } from '../lib/handoffLogger';

// Define agent types schema
export const AgentType = z.enum(['coordinator', 'linear']);
export type AgentType = z.infer<typeof AgentType>;

// Define handoff input schema
const LinearHandoffInput = z.object({
  task: z.string().describe('The Linear task to perform (e.g., create issue, search issues)'),
  context: z.string().nullable().optional().describe('Additional context for the Linear agent'),
  agentType: z.literal('linear'),
  traceId: z.string().uuid().nullable().optional().describe('Trace ID for logging purposes')
});

type LinearHandoffInput = z.infer<typeof LinearHandoffInput>;

// Create handoff to Linear agent with trace event
const linearHandoff = handoff(linearAgent, {
  toolNameOverride: 'handoff_to_linear',
  toolDescriptionOverride: 'Hand off to the Linear agent for issue management tasks',
  inputType: LinearHandoffInput,
  onHandoff: (_ctx, input: LinearHandoffInput | undefined) => {
    if (!input) return;
    
    // Create structured handoff events for tracing
    const { handoffEvent, receivedEvent } = logHandoff({
      traceId: input.traceId || 'unknown-trace',
      fromAgent: 'coordinator',
      toAgent: 'linear',
      input: input.task,
      context: input.context || undefined,
      task: input.task
    });

    // Log the events for debugging/monitoring
    console.log(`[HANDOFF EVENT]`, handoffEvent);
    console.log(`[RECEIVED EVENT]`, receivedEvent);
    
    // In a real implementation, these events would be saved to the trace:
    // await traceService.logHandoffPair(input.traceId, { handoffEvent, receivedEvent });
    
    // Legacy trace log for compatibility
    console.log(`[TRACE] Handoff from Coordinator to Linear Agent`, {
      task: input.task,
      context: input.context,
      timestamp: new Date().toISOString(),
      fromAgent: 'coordinator',
      toAgent: 'linear'
    });
  }
});

const coordinator = new Agent({
  name: 'Coordinator',
  instructions: `You are a helpful coordinator agent that manages conversations and delegates tasks to specialized agents.
    
    Your primary role is to:
    - Understand user requests and determine the best agent to handle them
    - Provide general assistance for non-specialized tasks
    - Hand off to the Linear agent for any Linear-related tasks (creating, updating, searching issues)
    
    Available agents to hand off to:
    - Linear Agent: For all Linear issue management tasks (create, search, update, get issues)
    
    When you need to hand off to the Linear agent, use the handoff_to_linear tool with:
    - task: A clear description of what the user wants to do with Linear
    - context: Any relevant context from the conversation
    - agentType: Always set to 'linear'
    
    Examples of Linear tasks:
    - "Create a new issue"
    - "Search for bugs in the mobile team"
    - "Update issue status"
    - "Find issues assigned to john@company.com"
    
    Be helpful and decide quickly whether a task should be handled by you or delegated.`,
  handoffs: [linearHandoff]
});

export default coordinator;
export { LinearHandoffInput };