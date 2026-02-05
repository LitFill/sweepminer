// ========================================
// Constants & Configurations
// ========================================

const CONSTANTS = Object.freeze({
  ROWS: 8,
  COLS: 8,
  MINES: 20,
  CELL_SIZE: 50,
  GAP: 4,
  OFFSET_X: 50,
  OFFSET_Y: 50,
  WIDTH: 600, // (50*8 + 4*7 + 100 padding) approx.
  HEIGHT: 600,
});

const COLORS = Object.freeze({
  HIDDEN: "#bdc3c7",
  REVEALED: "#ecf0f1",
  FLAGGED: "#f1c40f",
  BOMB: "#e74c3c",
  TEXT: "#2c3e50",
  HOVER: "rgba(255,255,235, 0.5)",
  HOVER_NEIGHBOR: "rgba(255,255,235, 0.2)",
});

const STATUS = Object.freeze({
  PLAYING: "playing",
  WON: "won",
  LOST: "lost",
});

// ========================================
// UTILITIES (Pure Functions)
// ========================================

/**
 * Pseudo-random Number Generator (Mulberry32)
 * @param {number} seed
 * @returns {() => number}
 */
const mkRNG = (seed) => {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Shuffle array immutably-ish (returns copy)
 * @template T
 * @param {T[]} array
 * @param {() => number} randomFn
 * @returns {T[]}
 */
const shuffle = (array, randomFn) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// ==========================================
// CORE LOGIC (Pure State Transformations)
// ==========================================

/**
 * @typedef {Object} Cell
 * @property {boolean} isBomb
 * @property {boolean} isOpen
 * @property {boolean} isFlagged
 * @property {number} neighborBombs
 */

/**
 * @typedef {Object} GameState
 * @property {Cell[][]} grid
 * @property {string} status
 * @property {{r: number, c: number} | null} hover
 * @property {Set<string>} hoverNeighbors
 */

/**
 * Create initial game state
 * @param {number} seed
 * @returns {GameState} the game state
 */
const mkGameState = (seed) => {
  const rng = mkRNG(seed);
  const { ROWS, COLS, MINES } = CONSTANTS;

  const positions = Array.from({ length: ROWS * COLS }, (_, i) => ({
    r: Math.floor(i / COLS),
    c: i % COLS,
  }));

  const shuffled = shuffle(positions, rng);
  const mineSet = new Set(shuffled.slice(0, MINES).map((p) => `${p.r},${p.c}`));

  /** @type {Cell[][]} */
  const grid = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      const isBomb = mineSet.has(`${r},${c}`);
      return {
        isBomb,
        isOpen: false,
        isFlagged: false,
        neighborBombs: 0,
      };
    }),
  );

  const finalGrid = grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell.isBomb) return cell;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr,
            nc = c + dc;
          if (grid[nr]?.[nc]?.isBomb) count++;
        }

      return { ...cell, neighborBombs: count };
    }),
  );

  return {
    grid: finalGrid,
    status: STATUS.PLAYING,
    hover: null,
    hoverNeighbors: new Set(),
  };
};

/**
 * Check if all non-bomb cells are open
 * @param {Cell[][]} grid
 * @returns {boolean}
 */
const checkWin = (grid) =>
  grid.every((row) => row.every((cell) => cell.isBomb || cell.isOpen));

/**
 * Get neighbor positions for a cell
 * @param {number} r
 * @param {number} c
 * @returns {string[]} Array of "r,c" strings
 */
const getNeighborPositions = (r, c) => {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;

      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < CONSTANTS.ROWS && nc >= 0 && nc < CONSTANTS.COLS)
        neighbors.push(`${nr},${nc}`);
    }
  return neighbors;
};

/**
 * Reveal a cell and cascade if empty
 * @param {GameState} state
 * @param {number} r
 * @param {number} c
 * @returns {GameState} New State
 */
const revealCell = (state, r, c) => {
  if (state.status !== STATUS.PLAYING) return state;
  const cell = state.grid[r]?.[c];

  if (!cell || cell.isOpen || cell.isFlagged) return state;

  const newGrid = state.grid.map((row) => row.map((cell) => ({ ...cell })));

  if (cell.isBomb) {
    newGrid.forEach((row) =>
      row.forEach((c) => {
        if (c.isBomb) c.isOpen = true;
      }),
    );
    return { ...state, grid: newGrid, status: STATUS.LOST };
  }

  // Flood reveal
  const stack = [{ r, c }];
  while (stack.length > 0) {
    const { r: curR, c: curC } = stack.pop();
    const current = newGrid[curR]?.[curC];

    if (!current || current.isOpen || current.isFlagged) continue;

    current.isOpen = true;

    if (current.neighborBombs === 0)
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr !== 0 || dc !== 0) stack.push({ r: curR + dr, c: curC + dc });
  }

  const isWin = checkWin(newGrid);
  return {
    ...state,
    grid: newGrid,
    status: isWin ? STATUS.WON : STATUS.PLAYING,
  };
};

/**
 * Toggle Flag
 * @param {GameState} state
 * @param {number} r
 * @param {number} c
 * @returns {GameState}
 */
const toggleFlag = (state, r, c) => {
  if (state.status !== STATUS.PLAYING) return state;

  const cell = state.grid[r]?.[c];
  if (!cell || cell.isOpen) return state;

  const newGrid = state.grid.map((row, rowIx) =>
    rowIx === r
      ? row.map((col, colIx) =>
          colIx === c ? { ...col, isFlagged: !col.isFlagged } : col,
        )
      : row,
  );
  return { ...state, grid: newGrid };
};

/**
 * Chord action - auto-flag or auto-reveal based on cell state
 * @param {GameState} state
 * @param {number} r
 * @param {number} c
 * @returns {GameState}
 */
const chordAction = (state, r, c) => {
  if (state.status !== STATUS.PLAYING) return state;

  const cell = state.grid[r]?.[c];
  if (!cell || !cell.isOpen || cell.isBomb || cell.neighborBombs === 0)
    return state;

  const newGrid = state.grid.map((row) => row.map((cell) => ({ ...cell })));

  // Count flagged and unflagged neighbors
  let flaggedCount = 0;
  let unflaggedHidden = [];

  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;

      const nr = r + dr;
      const nc = c + dc;
      const neighbor = newGrid[nr]?.[nc];
      if (!neighbor) continue;

      if (neighbor.isFlagged) flaggedCount++;
      else if (!neighbor.isOpen) unflaggedHidden.push({ r: nr, c: nc });
    }

  const remainingMines = cell.neighborBombs - flaggedCount;

  // Auto-flag: if remaining mines equals unflagged hidden cells
  if (remainingMines === unflaggedHidden.length && remainingMines > 0)
    unflaggedHidden.forEach(({ r, c }) => {
      newGrid[r][c].isFlagged = true;
    });
  // Chord: if all mines are flagged, reveal remaining cells
  else if (remainingMines === 0 && unflaggedHidden.length > 0) {
    let hitBomb = false;

    unflaggedHidden.forEach(({ r, c }) => {
      if (newGrid[r][c].isBomb) hitBomb = true;

      newGrid[r][c].isOpen = true;
    });

    if (hitBomb) {
      // Reveal all bombs
      newGrid.forEach((row) =>
        row.forEach((cell) => {
          if (cell.isBomb) cell.isOpen = true;
        }),
      );
      return { ...state, grid: newGrid, status: STATUS.LOST };
    }
  }

  const isWin = checkWin(newGrid);
  return {
    ...state,
    grid: newGrid,
    status: isWin ? STATUS.WON : STATUS.PLAYING,
  };
};

// ========================================
// RENDER SYSTEM
// ========================================

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {GameState} state
 */
const draw = (ctx, state) => {
  const { ROWS, COLS, CELL_SIZE, GAP, OFFSET_X, OFFSET_Y, WIDTH, HEIGHT } =
    CONSTANTS;

  // clear every frame
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // bg
  ctx.fillStyle = "#ecf0f1";
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = state.grid[r]?.[c];
      const x = OFFSET_X + c * (CELL_SIZE + GAP);
      const y = OFFSET_Y + r * (CELL_SIZE + GAP);

      // cell color
      ctx.fillStyle = cell.isOpen
        ? cell.isBomb
          ? COLORS.BOMB
          : COLORS.REVEALED
        : COLORS.HIDDEN;

      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      // draw cell content
      if (cell.isFlagged && !cell.isOpen) {
        ctx.fillStyle = COLORS.FLAGGED;
        ctx.beginPath();
        ctx.arc(
          x + CELL_SIZE / 2,
          y + CELL_SIZE / 2,
          CELL_SIZE / 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else if (cell.isOpen && !cell.isBomb && cell.neighborBombs > 0) {
        ctx.fillStyle = COLORS.TEXT;
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          String(cell.neighborBombs),
          x + CELL_SIZE / 2,
          y + CELL_SIZE / 2,
        );
      }

      // hover effects
      if (state.hover && state.hover.r === r && state.hover.c === c) {
        ctx.fillStyle = COLORS.HOVER;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      } else if (
        state.hover &&
        state.hoverNeighbors &&
        state.hoverNeighbors.has(`${r},${c}`)
      ) {
        ctx.fillStyle = COLORS.HOVER_NEIGHBOR;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }
};

// ========================================
// RUNTIME & EVENTS
// ========================================

const initApp = () => {
  const canvas = document.getElementById("gameCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext("2d");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("gameStatus");
  const bombsLeftEl = document.getElementById("bombsLeft");
  const cellsLeftEl = document.getElementById("cellsLeft");

  // canvas resolution
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${CONSTANTS.WIDTH}px`;
  canvas.style.height = `${CONSTANTS.HEIGHT}px`;
  canvas.width = CONSTANTS.WIDTH * dpr;
  canvas.height = CONSTANTS.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  // TODO: seed hardcoded in devel.
  const seed = 184254;
  let currentState = mkGameState(seed);

  const loop = () => {
    draw(ctx, currentState);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Event management

  /**
   * Helper: Coordinate mapping.
   * @param {MouseEvent} evt
   * @returns {{r: number, c: number} | null}
   */
  const getGridPos = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left - CONSTANTS.OFFSET_X;
    const y = evt.clientY - rect.top - CONSTANTS.OFFSET_Y;

    const size = CONSTANTS.CELL_SIZE + CONSTANTS.GAP;

    const r = Math.floor(y / size);
    const c = Math.floor(x / size);

    if (r >= 0 && c >= 0 && r < CONSTANTS.ROWS && c < CONSTANTS.COLS)
      return { r, c };
    return null;
  };

  /**
   * Helper: Update UI text.
   * @param {GameState} state
   */
  const updateStatusUI = (state) => {
    statusEl.textContent = state.status.toUpperCase();
    statusEl.className = state.status;

    // Calculate statistics
    let flaggedCount = 0;
    let unopenedCount = 0;

    state.grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell.isFlagged) flaggedCount++;
        if (!cell.isOpen) unopenedCount++;
      });
    });

    const bombsLeft = CONSTANTS.MINES - flaggedCount;
    const cellsLeft = unopenedCount - flaggedCount;

    bombsLeftEl.textContent = bombsLeft;
    cellsLeftEl.textContent = cellsLeft;
  };

  // Initialize UI
  updateStatusUI(currentState);

  canvas.addEventListener("mousemove", (e) => {
    const pos = getGridPos(e);
    let hoverNeighbors = new Set();

    if (pos) {
      const neighbors = getNeighborPositions(pos.r, pos.c);
      hoverNeighbors = new Set(neighbors);
    }

    currentState = { ...currentState, hover: pos, hoverNeighbors };
  });

  canvas.addEventListener("mouseleave", () => {
    currentState = { ...currentState, hover: null, hoverNeighbors: new Set() };
  });

  canvas.addEventListener("mousedown", (e) => {
    const pos = getGridPos(e);
    if (!pos) return;

    currentState =
      e.button === 0 // left click
        ? revealCell(currentState, pos.r, pos.c)
        : e.button === 2 // right click
          ? toggleFlag(currentState, pos.r, pos.c)
          : e.button === 1 // middle click for chord
            ? chordAction(currentState, pos.r, pos.c)
            : currentState;

    updateStatusUI(currentState);
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 1) e.preventDefault(); // prevent middle click scroll
  });

  resetBtn.addEventListener("click", () => {
    currentState = mkGameState(seed); // WARN: hardcoded seed
    updateStatusUI(currentState);
  });

  console.log(currentState);
};

document.addEventListener("DOMContentLoaded", initApp);
