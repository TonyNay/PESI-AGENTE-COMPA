export type JsonSchema = Record<string, unknown>;

export type RunStructuredOpts = {
  prompt: string;
  schema: JsonSchema;
  useWebTools: boolean;
  /** Etiqueta para logs (ej. "scraping"). */
  label?: string;
  /** Callback de progreso opcional para el timeline. */
  onProgress?: (message: string) => void;
  /** Archivos que el modelo puede leer (p. ej. un PDF subido por el usuario). */
  attachments?: Attachment[];
};

export type Attachment = { path: string; name: string; mediaType: string };

export type RunStructuredResult<T = unknown> = {
  data: T;
  costUsd?: number;
  durationMs?: number;
};

export interface LLMProvider {
  readonly name: string;
  runStructured<T = unknown>(opts: RunStructuredOpts): Promise<RunStructuredResult<T>>;
}

export type RawOffer = {
  competitor: string;
  product_title: string;
  price: number;
  currency: string;
  url: string;
  availability?: string;
  features?: string;
  rating?: number | null;
  match_score: number;
};
