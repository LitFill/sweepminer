/**
 * @typedef {Object} Colors
 * @property {string} unmarked
 * @property {string} marked
 * @property {string} empty
 * @property {string} number
 * @property {string} bomb
 */

/**
 * @typedef {Object} GridConfig
 * @property {number} rows - Number of rows in the grid
 * @property {number} cols - Number of columns in the grid
 * @property {number} cellSize - Size of each cell in pixels
 * @property {number} gap - Gap between cells
 * @property {Colors} colors - Hex or CSS color string for the grid lines
 * @property {number} offsetX - Horizontal margin from the edge
 * @property {number} offsetY - Vertical margin from the edge
 */

const CellState = Object.freeze({
  CloseUnmarked: "close-unmarked",
  CloseMarked: "close-marked",
  OpenNumber0: 0,
  OpenNumber1: 1,
  OpenNumber2: 2,
  OpenNumber3: 3,
  OpenNumber4: 4,
  OpenNumber5: 5,
  OpenNumber6: 6,
  OpenNumber7: 7,
  OpenNumber8: 8,
  OpenBomb: "bomb",
});

/**
 * @typedef {Object} GameConfig
 * @property {GridConfig} gridConfig
 * @property {CellState[][]} boardState
 * @property {(-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)[][]} stageBoard
 * @property {{row: number, col: number}} hoveredCell
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function setupCanvas(canvas, ctx, width, height) {
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  ctx.scale(dpr, dpr);
}

/**
 * @param {number} r
 * @param {number} c
 * @param {GameConfig} gameConfig
 */
function revealCell(r, c, gameConfig) {
  const { rows, cols } = gameConfig.gridConfig;

  if (r < 0 || c < 0 || r >= rows || c >= cols) return;
  if (gameConfig.boardState[r][c] !== CellState.CloseUnmarked) return;

  const value = gameConfig.stageBoard[r][c];

  if (value === -1) {
    gameConfig.boardState[r][c] = CellState.OpenBomb;
    alert("BOOM!! Game Over");
    location.reload();
    return;
  }

  switch (value) {
    case 0:
      gameConfig.boardState[r][c] = CellState.OpenNumber0;
      break;
    case 1:
      gameConfig.boardState[r][c] = CellState.OpenNumber1;
      break;
    case 2:
      gameConfig.boardState[r][c] = CellState.OpenNumber2;
      break;
    case 3:
      gameConfig.boardState[r][c] = CellState.OpenNumber3;
      break;
    case 4:
      gameConfig.boardState[r][c] = CellState.OpenNumber4;
      break;
    case 5:
      gameConfig.boardState[r][c] = CellState.OpenNumber5;
      break;
    case 6:
      gameConfig.boardState[r][c] = CellState.OpenNumber6;
      break;
    case 7:
      gameConfig.boardState[r][c] = CellState.OpenNumber7;
      break;
    case 8:
      gameConfig.boardState[r][c] = CellState.OpenNumber8;
      break;

    default:
      break;
  }

  if (value === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        revealCell(r + dr, c + dc, gameConfig);
      }
    }
  }
}

/**
 * @param {GameConfig} gameConfig
 */
function update(gameConfig) {
  const { rows, cols } = gameConfig.gridConfig;
  let unrevealedSafeCells = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (
        gameConfig.stageBoard[r][c] !== -1 &&
        gameConfig.boardState[r][c] === CellState.CloseUnmarked
      )
        unrevealedSafeCells++;
    }
  }
  if (unrevealedSafeCells === 0) {
    alert("Selamat! Kamu menang!");
    location.reload();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {GameConfig} gameConfig
 * @param {number} width
 * @param {number} height
 */
function draw(ctx, gameConfig, width, height) {
  const { rows, cols, offsetX, offsetY, cellSize, gap, colors } =
    gameConfig.gridConfig;

  ctx.clearRect(0, 0, width, height);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = offsetX + col * (cellSize + gap);
      const y = offsetY + row * (cellSize + gap);

      switch (gameConfig.boardState[row][col]) {
        case CellState.CloseUnmarked: {
          ctx.fillStyle = colors.unmarked;
          ctx.fillRect(x, y, cellSize, cellSize);
          break;
        }
        case CellState.CloseMarked: {
          ctx.fillStyle = colors.marked;
          ctx.fillRect(x, y, cellSize, cellSize);
          break;
        }
        case CellState.OpenBomb: {
          ctx.fillStyle = colors.bomb;
          ctx.fillRect(x, y, cellSize, cellSize);
          break;
        }
        // Angka
        default:
          {
            ctx.fillStyle = colors.number;
            ctx.fillRect(x, y, cellSize, cellSize);
            if (gameConfig.stageBoard[row][col] > 0) {
              ctx.fillStyle = "black";
              ctx.font = "20px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.textRendering = "optimizeSpeed";

              ctx.fillText(
                gameConfig.stageBoard[row][col],
                x + cellSize / 2,
                y + cellSize / 2,
              );
            }
          }

          // --- LOGIKA HOVER OUTLINE ---
          if (
            gameConfig.hoveredCell.row === row &&
            gameConfig.hoveredCell.col === col
          ) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; // Warna putih transparan
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
          }
      }
    }
  }
}

/**
 * @param {number} seed
 */
function mkRNG(seed) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} seed
 * @returns { GameConfig }
 */
function getConfig(seed) {
  const random = mkRNG(seed);

  /** @type {Colors} */
  const colors = {
    unmarked: "darkgrey",
    marked: "yellow",
    empty: "grey",
    number: "lightgrey",
    bomb: "red",
  };

  /** @type {GridConfig} */
  const gridConfig = {
    rows: 8,
    cols: 8,
    cellSize: 50,
    gap: 5,
    colors,
    offsetX: 50,
    offsetY: 50,
  };

  const { rows, cols } = gridConfig;
  const totalMines = Math.min(25, rows * cols);

  /** @type {CellState[][]} */
  const boardState = Array.from({ length: rows }, () =>
    Array(cols).fill(CellState.CloseUnmarked),
  );

  /** @type {(-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)[][]} */
  const stageBoard = Array.from({ length: rows }, () => Array(cols).fill(0));

  const positions = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) positions.push({ r, c });

  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  for (let i = 0; i < totalMines; i++) {
    const { r, c } = positions[i];
    stageBoard[r][c] = -1;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (stageBoard[r][c] === -1) continue;

      let mineCount = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < rows && nc < cols) {
            if (stageBoard[nr][nc] === -1) mineCount++;
          }
        }
      }
      stageBoard[r][c] = mineCount;
    }
  }

  return {
    gridConfig,
    boardState,
    stageBoard,
    hoveredCell: { row: -1, col: -1 },
  };
}

(() => {
  const game = document.getElementById("game");
  if (!game) return;

  const WIDTH = 800;
  const HEIGHT = 600;

  const SEED = 184254;
  const gameConfig = getConfig(SEED);

  const canvas = document.getElementById("gameCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  setupCanvas(canvas, ctx, WIDTH, HEIGHT);

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const { offsetX, offsetY, cellSize, gap, rows, cols } =
      gameConfig.gridConfig;
    const mouseX = e.clientX - rect.width;
    const mouseY = e.clientY - rect.height;
    const col = Math.floor((mouseX - offsetX) / (cellSize + gap));
    const row = Math.floor((mouseY - offsetY) / (cellSize + gap));
    if (row >= 0 && col >= 0 && row < rows && col < cols)
      gameConfig.hoveredCell = { row, col };
    else gameConfig.hoveredCell = { row: -1, col: -1 };
  });

  canvas.addEventListener("mousedown", (e) => {
    const { row, col } = gameConfig.hoveredCell;
    if (row !== -1 && col !== -1) {
      // Klik kiri
      if (e.button === 0) revealCell(row, col, gameConfig);
      // Klik kanan
      else if (e.button === 2) {
        const currentState = gameConfig.boardState[row][col];
        if (currentState === CellState.CloseUnmarked)
          gameConfig.boardState[row][col] = CellState.CloseMarked;
        else if (currentState === CellState.CloseMarked)
          gameConfig.boardState[row][col] = CellState.CloseUnmarked;
      }
    }
  });

  // Hapus mouse keluar canvas
  canvas.addEventListener("mouseleave", () => {
    gameConfig.hoveredCell = { row: -1, col: -1 };
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function main() {
    update(gameConfig);
    draw(ctx, gameConfig, WIDTH, HEIGHT);
    requestAnimationFrame(main);
  }

  main();

  console.log(gameConfig);
})();
