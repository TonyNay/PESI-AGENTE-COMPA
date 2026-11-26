import type { LLMProvider } from "../types";
import { ClaudeCliProvider } from "./claude-cli";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";

export function getProvider(name?: string): LLMProvider {
  const p = (name || process.env.AGENT_PROVIDER || "claude-cli").toLowerCase();
  switch (p) {
    case "mock": return new MockProvider();
    case "anthropic": return new AnthropicProvider();
    case "claude-cli": return new ClaudeCliProvider();
    default: throw new Error(`AGENT_PROVIDER desconocido: ${p} (usa claude-cli | anthropic | mock)`);
  }
}
