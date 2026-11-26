import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LLMProvider, RunStructuredOpts, RunStructuredResult } from "../types";

const TIMEOUT_MS = 6 * 60 * 1000;

function stripFences(s: string) {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/** Ejecuta Claude Code en modo headless (sustituto de la API mientras no haya API key). */
export class ClaudeCliProvider implements LLMProvider {
  readonly name = "claude-cli";
  private model = process.env.CLAUDE_CLI_MODEL || "claude-haiku-5-5";
  private effort = process.env.CLAUDE_CLI_EFFORT || "medium";
  private bin = process.env.CLAUDE_CLI_BIN || "claude";

  async runStructured<T = unknown>(opts: RunStructuredOpts): Promise<RunStructuredResult<T>> {
    const tools = [...(opts.useWebTools ? ["WebSearch", "WebFetch"] : []), ...(opts.attachments?.length ? ["Read"] : [])];
    const args = [
      "-p", opts.prompt,
      "--model", this.model,
      "--effort", this.effort,
      ...(tools.length ? ["--allowedTools", ...tools] : []),
      "--output-format", "json",
      "--json-schema", JSON.stringify(opts.schema),
    ];
    opts.onProgress?.(`Ejecutando Claude Code (${this.model}, effort ${this.effort})${opts.useWebTools ? " con WebSearch/WebFetch" : ""}…`);

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "compa-agent-"));
    try {
      for (const a of opts.attachments ?? []) fs.copyFileSync(a.path, path.join(cwd, a.name));
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(this.bin, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`Tiempo de espera agotado (${TIMEOUT_MS / 60000} min) ejecutando claude CLI`));
        }, TIMEOUT_MS);
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("error", (e) => { clearTimeout(timer); reject(new Error(`No se pudo ejecutar '${this.bin}': ${e.message}`)); });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (code !== 0 && !out.trim()) reject(new Error(`claude CLI terminó con código ${code}: ${err.slice(0, 500)}`));
          else resolve(out);
        });
      });

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        throw new Error(`Salida de claude CLI no es JSON válido: ${stdout.slice(0, 300)}`);
      }
      if (parsed.is_error) throw new Error(`claude CLI reportó error: ${String(parsed.result ?? parsed.subtype ?? "desconocido").slice(0, 500)}`);

      let data: unknown = parsed.structured_output;
      if (data == null && typeof parsed.result === "string") {
        try { data = JSON.parse(stripFences(parsed.result)); }
        catch { throw new Error(`No se obtuvo salida estructurada. result: ${parsed.result.slice(0, 300)}`); }
      }
      if (data == null) throw new Error("claude CLI no devolvió structured_output ni result");
      return {
        data: data as T,
        costUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : undefined,
        durationMs: typeof parsed.duration_ms === "number" ? parsed.duration_ms : undefined,
      };
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  }
}
