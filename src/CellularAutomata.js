// CellularAutomata.js
// Core logic for cellular automata rules

export const RULES = {
  life: {
    name: "Conway's Game of Life (B3/S23)",
    birth: [3],
    survive: [2, 3],
  },
  highlife: {
    name: "HighLife (B36/S23)",
    birth: [3, 6],
    survive: [2, 3],
  },
  seeds: {
    name: "Seeds (B2/S)",
    birth: [2],
    survive: [],
  },
  daynight: {
    name: "Day & Night (B3678/S34678)",
    birth: [3, 6, 7, 8],
    survive: [3, 4, 6, 7, 8],
  },
  diamoeba: {
    name: "Diamoeba (B35678/S5678)",
    birth: [3, 5, 6, 7, 8],
    survive: [5, 6, 7, 8],
  },
  morley: {
    name: "Morley (B368/S245)",
    birth: [3, 6, 8],
    survive: [2, 4, 5],
  },
  maze: {
    name: "Maze (B3/S12345)",
    birth: [3],
    survive: [1, 2, 3, 4, 5],
  },
  anneal: {
    name: "Anneal (B4678/S35678)",
    birth: [4, 6, 7, 8],
    survive: [3, 5, 6, 7, 8],
  },
};

export function stepAutomaton(grid, ruleKey, resolution) {
  const rule = RULES[ruleKey];
  const n = resolution;
  const next = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = (y + dy + n) % n;
          const nx = (x + dx + n) % n;
          if (grid[ny * n + nx]) neighbors++;
        }
      }
      const idx = y * n + x;
      if (!grid[idx] && rule.birth.includes(neighbors)) {
        next[idx] = 1;
      } else if (grid[idx] && rule.survive.includes(neighbors)) {
        next[idx] = 1;
      } else {
        next[idx] = 0;
      }
    }
  }
  return next;
}
