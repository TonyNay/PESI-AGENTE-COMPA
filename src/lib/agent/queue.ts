import { runAnalysis } from "./orchestrator";
import { runStrategic } from "./strategic";

const MAX_CONCURRENCY = 2;
type Job = { label: string; id: number; run: (id: number) => Promise<void> };
type Q = { pending: Job[]; active: number };
const g = globalThis as typeof globalThis & { __compaQueue?: Q };
const q: Q = (g.__compaQueue ??= { pending: [], active: 0 });

function pump() {
  while (q.active < MAX_CONCURRENCY && q.pending.length) {
    const job = q.pending.shift()!;
    q.active++;
    job.run(job.id)
      .catch((e) => console.error(`[compa] error en ${job.label}`, job.id, e))
      .finally(() => { q.active--; pump(); });
  }
}

function enqueue(job: Job) {
  q.pending.push(job);
  setImmediate(pump);
}

/** Encola un análisis; se ejecuta en segundo plano (concurrencia máx. 2, compartida). */
export function enqueueAnalysis(id: number) {
  enqueue({ label: "análisis", id, run: runAnalysis });
}

export function enqueueStrategic(id: number) {
  enqueue({ label: "análisis estratégico", id, run: runStrategic });
}
