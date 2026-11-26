import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import type { LLMProvider, RunStructuredOpts, RunStructuredResult } from "../types";

/**
 * Proveedor basado en la API de Anthropic. Se activa con AGENT_PROVIDER=anthropic + ANTHROPIC_API_KEY.
 * Usa las server tools de búsqueda web y lectura de páginas (web_search / web_fetch) y
 * salida estructurada (output_config.format = json_schema).
 *
 * Haiku 5.5 usa las variantes básicas de las server tools (`web_search_20250305`, `web_fetch_20250910`).
 * Con modelos más grandes (Sonnet 5.5 / Opus 5.5) puedes poner ANTHROPIC_WEB_TOOLS=dynamic
 * para usar las variantes `_20260209` con filtrado dinámico.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("AGENT_PROVIDER=anthropic requiere ANTHROPIC_API_KEY en el entorno (.env.local).");
    }
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  private tools(): Anthropic.Messages.ToolUnion[] {
    const dynamic = process.env.ANTHROPIC_WEB_TOOLS === "dynamic";
    const searchType = dynamic ? "web_search_20260209" : "web_search_20250305";
    const fetchType = dynamic ? "web_fetch_20260209" : "web_fetch_20250910";
    return [
      // Sin user_location: la API rechaza country "PE". La localización a Perú va en las consultas del prompt.
      { type: searchType, name: "web_search", max_uses: 8 },
      { type: fetchType, name: "web_fetch", max_uses: 8 },
    ] as unknown as Anthropic.Messages.ToolUnion[];
  }

  async runStructured<T = unknown>(opts: RunStructuredOpts): Promise<RunStructuredResult<T>> {
    const started = Date.now();
    const docs = (opts.attachments ?? [])
      .filter((a) => a.mediaType === "application/pdf")
      .map((a) => ({
        type: "document" as const,
        title: a.name,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: fs.readFileSync(a.path).toString("base64") },
      }));
    const userMessage = (text: string): Anthropic.Messages.MessageParam =>
      ({ role: "user", content: docs.length ? [...docs, { type: "text", text }] : text });
    const messages: Anthropic.Messages.MessageParam[] = [userMessage(opts.prompt)];
    // Si la API rechaza el esquema por tamaño de gramática, se reintenta sin salida estricta (esquema en el prompt).
    let strict = true;
    const effort = (process.env.ANTHROPIC_EFFORT || "medium") as "low" | "medium" | "high";
    let inTok = 0, outTok = 0;
    let finalText = "";

    for (let turn = 0; turn < 6; turn++) {
      opts.onProgress?.(`Llamando a ${this.model}${opts.useWebTools ? " con web_search/web_fetch" : ""} (turno ${turn + 1})…`);
      let msg: Anthropic.Messages.Message;
      try {
        const stream = this.client.messages.stream({
          model: this.model,
          max_tokens: 32000,
          messages,
          ...(opts.useWebTools ? { tools: this.tools() } : {}),
          output_config: strict ? { effort, format: { type: "json_schema", schema: opts.schema } } : { effort },
        } as unknown as Anthropic.Messages.MessageStreamParams);
        msg = await stream.finalMessage();
      } catch (e) {
        if (strict && turn === 0 && /grammar is too large/i.test((e as Error).message)) {
          strict = false;
          opts.onProgress?.("El esquema supera el límite de gramática de la API; se reintenta con el esquema dentro del prompt.");
          messages[0] = userMessage(`${opts.prompt}\n\nResponde SOLO con un objeto JSON válido (sin texto adicional ni bloques de código) que cumpla este JSON Schema:\n${JSON.stringify(opts.schema)}`);
          turn--;
          continue;
        }
        throw e;
      }
      inTok += msg.usage.input_tokens;
      outTok += msg.usage.output_tokens;

      if (msg.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      if (msg.stop_reason === "refusal") throw new Error("El modelo rechazó la solicitud (refusal).");
      if (msg.stop_reason === "max_tokens") throw new Error("La respuesta superó max_tokens.");
      finalText = msg.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      break;
    }
    if (!finalText) throw new Error("La API no devolvió texto estructurado.");
    let data: T;
    try {
      const text = finalText.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      // Sin salida estricta el modelo puede anteponer texto: se toma del primer "{" al último "}".
      data = JSON.parse(strict ? text : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    } catch {
      throw new Error(`Respuesta no es JSON válido: ${finalText.slice(0, 300)}`);
    }
    // Costo estimado Haiku 5.5: $0.10 / $0.50 por MTok (≤100K de prompt). Solo referencial.
    const costUsd = this.model === "claude-haiku-5-5" ? (inTok * 0.1 + outTok * 0.5) / 1e6 : undefined;
    return { data, costUsd, durationMs: Date.now() - started };
  }
}
