import { AgenticTrace } from "@/models/agenticTraceSchemas";
import { Agent, Handoff, Tool } from '@openai/agents';

export type AgentTracing = (t:AgenticTrace) => Agent;
export type ToolTracing = (t:AgenticTrace) => Tool;
export type HandoffTracing = (t:AgenticTrace) => Handoff;
