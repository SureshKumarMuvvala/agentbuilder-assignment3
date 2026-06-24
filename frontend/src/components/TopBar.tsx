// TopBar — brand + a quiet provider status pill.
//
// The LLM provider switch (mock | openai | anthropic) used to be a prominent dev
// control in the header. Here it's demoted to a calm status pill on the right: a
// coloured dot (mock = amber, live = emerald) plus a compact <select>. It reads
// as "system status", not "debugger knob".

import type { AppConfig } from "../types";
import logoUrl from "../assets/launchlens-logo.png";

interface Props {
  config: AppConfig | null;
  running: boolean;
  onProviderChange: (provider: string) => void;
  providerError: string | null;
}

export default function TopBar({ config, running, onProviderChange, providerError }: Props) {
  return (
    <header className="flex items-center gap-3 border-b border-hairline bg-surface-1/60 px-4 py-2.5 backdrop-blur">
      {/* Brand — transparent logo lockup (icon + wordmark), no backing, sized to
          the header height so it reads against the dark UI. */}
      <img src={logoUrl} alt="LaunchLens" className="h-9 w-auto object-contain" />


      <div className="ml-auto flex items-center gap-3">
        {providerError && <span className="text-[11px] text-verdict-nogo">{providerError}</span>}
        {config && (
          <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: config.mock ? "#fbbf24" : "#34d399" }}
              title={config.mock ? "mock mode (fixtures, no keys)" : "live mode"}
            />
            <span className="text-[11px] text-slate-400">{config.mock ? "Mock" : "Live"}</span>
            <span className="text-slate-600">·</span>
            <select
              className="bg-transparent text-[11px] font-medium text-slate-200 outline-none disabled:opacity-50"
              value={config.provider}
              disabled={running}
              onChange={(e) => onProviderChange(e.target.value)}
              title={running ? "Can't switch mid-run" : "Switch LLM provider"}
            >
              {config.providers.map((p) => (
                <option key={p.name} value={p.name} disabled={!p.available} className="bg-surface-2">
                  {p.name}
                  {p.available ? "" : " (no key)"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </header>
  );
}
