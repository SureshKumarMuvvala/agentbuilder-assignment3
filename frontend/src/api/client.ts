// Thin API client for the LaunchLens backend.
//
// Everything is served under /api (Vite proxies that to FastAPI on :8000).
// The chat endpoint streams Server-Sent Events, but it's a POST (the question is
// in the body), and the browser's EventSource only does GET — so we read the
// response body as a stream and parse the SSE frames ourselves.

import type { AppConfig, GraphState, GraphTopology, StreamEvent } from "../types";

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch("/api/config");
  return res.json();
}

/**
 * Switch the active LLM provider (mock | openai | anthropic).
 * Throws with the backend's message if the provider is unknown or its key is
 * missing, so the UI can surface a clear error.
 */
export async function setProvider(provider: string): Promise<AppConfig> {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `Failed to switch provider (${res.status})`);
  }
  return res.json();
}

export async function fetchGraph(): Promise<GraphTopology> {
  const res = await fetch("/api/graph");
  return res.json();
}

export async function fetchThreads(): Promise<{ thread_id: string }[]> {
  const res = await fetch("/api/threads");
  const data = await res.json();
  return data.threads;
}

export async function createThread(): Promise<string> {
  const res = await fetch("/api/threads", { method: "POST" });
  const data = await res.json();
  return data.thread_id;
}

export async function fetchThreadState(threadId: string): Promise<GraphState> {
  const res = await fetch(`/api/threads/${encodeURIComponent(threadId)}/state`);
  const data = await res.json();
  return data.state;
}

/**
 * Run one chat turn and invoke `onEvent` for every streamed graph event.
 *
 * We POST the question, then read the response body as a UTF-8 stream and split
 * it into SSE frames (blank-line separated). Each frame's `data:` line is a JSON
 * StreamEvent. Resolves when the stream closes.
 */
export async function streamChat(
  question: string,
  threadId: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, thread_id: threadId }),
  });
  if (!res.body) throw new Error("No response body from /api/chat");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // Normalize CRLF -> LF: sse-starlette emits `\r\n` line endings, so frames
    // are separated by `\r\n\r\n`. Normalizing lets us split on a plain blank
    // line regardless of which the server uses.
    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");

    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      // A frame may carry several lines (and `:` comment/ping lines); we only
      // need the `data:` payload.
      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const json = dataLine.slice("data:".length).trim();
      if (json) onEvent(JSON.parse(json) as StreamEvent);
    }
  }
}
