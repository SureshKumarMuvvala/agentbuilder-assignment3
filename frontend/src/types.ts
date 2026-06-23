// Shared types describing the JSON the backend streams and serves.
// These mirror launchlens/api/serializers.py and streaming.py exactly.

export type Role = "human" | "ai" | "system" | "tool" | "remove" | "other";

export interface ToolCall {
  name: string;
  args: unknown;
  id?: string;
}

export interface ChatMessage {
  role: Role;
  content: string;
  id?: string | null;
  tool_calls?: ToolCall[];
  name?: string | null;
  tool_call_id?: string | null;
}

export interface GraphState {
  messages: ChatMessage[];
  research: Record<string, unknown>;
  query: string;
  intent: string;
}

export interface GraphNode {
  id: string;
  label: string;
  concept: string;
  color: string;
  blurb?: string;
  group: "control" | "main" | "research";
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "normal" | "conditional";
}

export interface GraphTopology {
  nodes: GraphNode[];
  edges: GraphEdge[];
  intent_plan: Record<string, string[]>;
}

export interface ProviderOption {
  name: string;
  available: boolean;
}

export interface AppConfig {
  provider: string;
  mock: boolean;
  default_thread_id: string;
  providers: ProviderOption[];
}

// The discriminated union of every Server-Sent Event the backend emits.
export type StreamEvent =
  | { type: "run_start"; thread_id: string; question: string }
  | {
      type: "node_start";
      node: string;
      step: number;
      task_id: string;
      label: string;
      concept: string;
      color: string;
      blurb: string;
    }
  | {
      type: "node_end";
      node: string;
      task_id: string;
      duration_ms: number | null;
      delta: Record<string, unknown>;
      error: string | null;
    }
  | { type: "tool_start"; node: string; tool: string; input: string }
  | { type: "tool_end"; node: string; tool: string; output: unknown; error: boolean }
  | { type: "routing"; intent: string; keyword: string; targets: string[] }
  | { type: "checkpoint"; step: number; next: string[] }
  | { type: "final"; state: GraphState; verdict: string }
  | { type: "error"; message: string }
  | { type: "done" };
