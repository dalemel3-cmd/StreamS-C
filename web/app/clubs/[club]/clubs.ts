export type Club =
  | { kind: "total"; title: string; target: number }
  | { kind: "speed"; title: string; mph: number };

export const CLUBS: Record<string, Club> = {
  "1000": { kind: "total", title: "1,000 lb club", target: 1000 },
  "19mph": { kind: "speed", title: "19 mph club", mph: 19 },
  "20mph": { kind: "speed", title: "20 mph club", mph: 20 },
  "21mph": { kind: "speed", title: "21 mph club", mph: 21 },
  "22mph": { kind: "speed", title: "22 mph club", mph: 22 },
};
