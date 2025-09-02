import { Agent, handoff } from '@openai/agents';
import linearAgent from './linear-agent';
import { AgentTracing, HandoffTracing } from './util';
import { agenticTraceService } from '@/lib/firebase';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';

export const coordinator: AgentTracing = (t) => {
  // Create handoff to Linear agent with trace event
  const linearHandoff: HandoffTracing = (t) => handoff(linearAgent(t), {
    onHandoff: async (_ctx, input: unknown) => {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'handoff',
        input: {
          data: input,
        },
        agent: 'coordinator',
        output: {},
        timestamp: new Date().toISOString(),
        markdown: `Handed off to Linear agent.`
      });
    }
  });

  return new Agent({
  name: 'Coordinator',
  instructions: `${RECOMMENDED_PROMPT_PREFIX}
  You are a helpful coordinator agent that manages conversations and delegates tasks to specialized agents.
    
    Your primary role is to:
    - Understand user requests and determine the best agent to handle them
    - Provide general assistance for non-specialized tasks
    
    Be helpful and decide quickly whether a task should be handled by you or delegated.`,
    handoffs: [linearHandoff(t)]
  });
};

export default coordinator;