/** GLB asset boundary; model loading is opt-in and owned by the consumer. */
export interface GlbAdapter {
  initialize?(): Promise<void>;
  load?(manifest: unknown): Promise<void>;
  unload?(): void;
  dispose?(): void;
}

