export type AuditSnapshot = {
  id: string;
  image: string;
  timestamp: string;
  glasses: string;
  pose: string;
  scale: number;
  alignmentError: number | null;
  cameraState: string;
  diagnosticState: string;
};

export function createAuditHistory(limit = 8) {
  const items: AuditSnapshot[] = [];
  return {
    add(snapshot: AuditSnapshot) {
      items.unshift(snapshot);
      if (items.length > limit) items.length = limit;
      return [...items];
    },
    list() { return [...items]; },
    clear() { items.length = 0; },
  };
}
