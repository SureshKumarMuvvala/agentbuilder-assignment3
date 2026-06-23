// Chat — the conversation panel: founder questions + LaunchLens verdicts, plus
// the input box. Memory is the point here: because every turn shares one
// thread_id, the transcript (and the agent's awareness of it) persists across
// turns and restarts.

import { useState } from "react";
import type { ChatMessage } from "../types";

interface Props {
  transcript: ChatMessage[];
  running: boolean;
  onSend: (question: string) => void;
}

function Bubble({ message }: { message: ChatMessage }) {
  const isHuman = message.role === "human";
  return (
    <div className={`flex ${isHuman ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm"
        style={{
          background: isHuman ? "#1d4ed8" : "#0f1623",
          border: isHuman ? "none" : "1px solid #1e3a2f",
          color: isHuman ? "#eff6ff" : "#d1fae5",
        }}
      >
        {!isHuman && <div className="mb-0.5 text-[10px] font-semibold text-green-400">LaunchLens</div>}
        {message.content}
      </div>
    </div>
  );
}

export default function Chat({ transcript, running, onSend }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    const q = text.trim();
    if (!q || running) return;
    onSend(q);
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {transcript.length === 0 && (
          <div className="mt-6 text-center text-sm text-slate-500">
            Ask whether to launch a product idea.
            <div className="mt-2 text-[11px] text-slate-600">
              e.g. “Should I launch an insulated steel water bottle?”
            </div>
          </div>
        )}
        {transcript.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {running && (
          <div className="text-[11px] text-yellow-400">▶ researching demand + supply…</div>
        )}
      </div>

      <div className="border-t border-slate-800 p-2">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="Type a product idea…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            disabled={running}
          />
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={submit}
            disabled={running}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
