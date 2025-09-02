import { Agent } from '@openai/agents';
import { linearHandoff } from './linear-agent';
import { AgentTracing } from './util';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';

export const coordinator: AgentTracing = (t) => {
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