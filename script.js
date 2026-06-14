const board = document.getElementById("board");
const rollButton = document.getElementById("roll-button");
const diceResult = document.getElementById("dice-result");
const cpuStatus = document.getElementById("cpu-status");
const currentPlayerText = document.getElementById("current-player");
const nextTurnButton = document.getElementById("next-turn-button");
const resourcesDiv = document.getElementById("resources");
const HEX_WIDTH = 70;
const HEX_HEIGHT = 80;

const HORIZONTAL_SPACING = HEX_WIDTH;
const VERTICAL_SPACING = HEX_HEIGHT * 0.75;
const scoresDiv = document.getElementById("scores");
const discardArea = document.getElementById("discard-area");
const stealArea = document.getElementById("steal-area");
const devCardsDiv = document.getElementById("dev-cards");
const saveGameButton = document.getElementById("save-game-button");
const clearSaveButton = document.getElementById("clear-save-button");

let discardState = null;
let largestArmyOwner = null;
let longestRoadOwner = null;
let freeRoadBuildCount = 0;

const players = ["青", "赤", "黄", "緑"];
const CPU_THINK_TIME = 800;
const CPU_ACTION_INTERVAL = 600;
let humanPlayerIndex = Math.floor(Math.random() * players.length);
function isCpuPlayer(playerIndex) {
  return playerIndex !== humanPlayerIndex;
}

function isCurrentPlayerCpu() {
  return isCpuPlayer(getCurrentPlayer());
}
const knightCount = [0, 0, 0, 0];
let currentPlayerIndex = 0;
let robberTileIndex = 9; // 最初は砂漠に置く
let isRobberMoving = false;
let hasRolledDice = false;

let tiles = [
  { type: "forest", label: "木", number: 5 },
  { type: "field", label: "麦", number: 2 },
  { type: "pasture", label: "羊", number: 6 },

  { type: "hill", label: "土", number: 3 },
  { type: "mountain", label: "鉄", number: 8 },
  { type: "forest", label: "木", number: 10 },
  { type: "field", label: "麦", number: 9 },

  { type: "pasture", label: "羊", number: 12 },
  { type: "hill", label: "土", number: 11 },
  { type: "desert", label: "砂", number: null },
  { type: "mountain", label: "鉄", number: 4 },
  { type: "forest", label: "木", number: 8 },

  { type: "field", label: "麦", number: 10 },
  { type: "pasture", label: "羊", number: 9 },
  { type: "hill", label: "土", number: 4 },
  { type: "mountain", label: "鉄", number: 5 },

  { type: "forest", label: "木", number: 6 },
  { type: "field", label: "麦", number: 3 },
  { type: "pasture", label: "羊", number: 11 },
];

const playerResources = [
  { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
  { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
  { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
  { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
];

const COSTS = {
  road: { 木: 1, 土: 1 },
  settlement: { 木: 1, 土: 1, 麦: 1, 羊: 1 },
  city: { 麦: 2, 鉄: 3 },
};
const rowCounts = [3, 4, 5, 4, 3];

const developmentDeck = [
  ...Array(14).fill("knight"),
  ...Array(5).fill("victory"),
  ...Array(2).fill("road_building"),
  ...Array(2).fill("year_of_plenty"),
  ...Array(2).fill("monopoly"),
];
const playerDevelopmentCards = [[], [], [], []];

const ports = [
  { tileIndex: 0, side: 5, type: "any" },
  { tileIndex: 1, side: 0, type: "木" },
  { tileIndex: 3, side: 5, type: "羊" },
  { tileIndex: 7, side: 4, type: "麦" },
  { tileIndex: 11, side: 1, type: "土" },
  { tileIndex: 15, side: 2, type: "鉄" },
];
const tradeArea = document.getElementById("trade-area");
const giveControls = document.getElementById("give-controls");
const receiveControls = document.getElementById("receive-controls");
const tradeTarget = document.getElementById("trade-target");
const RESOURCES = ["木", "麦", "羊", "土", "鉄"];

let tradeState = {
  give: { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
  receive: { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
};
let pendingCpuTrade = null;

let settlements = [];
let roads = [];

let vertices = [];
let edges = [];
let vertexNeighbors = {};

let phase = "setup";
let setupStep = "settlement";
let setupTurnOrder = [0, 1, 2, 3, 3, 2, 1, 0];
let setupIndex = 0;
let lastSetupSettlementKey = null;

function getHexVertices(x, y) {
  return [
    { x: x + HEX_WIDTH / 2, y: y },
    { x: x + HEX_WIDTH, y: y + HEX_HEIGHT * 0.25 },
    { x: x + HEX_WIDTH, y: y + HEX_HEIGHT * 0.75 },
    { x: x + HEX_WIDTH / 2, y: y + HEX_HEIGHT },
    { x: x, y: y + HEX_HEIGHT * 0.75 },
    { x: x, y: y + HEX_HEIGHT * 0.25 },
  ];
}

function getVertexKey(vertex) {
  return `${Math.round(vertex.x)}-${Math.round(vertex.y)}`;
}

function addNeighbor(keyA, keyB) {
  if (!vertexNeighbors[keyA]) {
    vertexNeighbors[keyA] = [];
  }

  if (!vertexNeighbors[keyB]) {
    vertexNeighbors[keyB] = [];
  }

  if (!vertexNeighbors[keyA].includes(keyB)) {
    vertexNeighbors[keyA].push(keyB);
  }

  if (!vertexNeighbors[keyB].includes(keyA)) {
    vertexNeighbors[keyB].push(keyA);
  }
}

function buildBoardGraph(tilePositions) {
  vertices = [];
  edges = [];
  vertexNeighbors = {};

  tilePositions.forEach((pos) => {
    const hexVertices = getHexVertices(pos.x, pos.y);
    const keys = hexVertices.map(getVertexKey);

    hexVertices.forEach((vertex, index) => {
      const key = keys[index];

      if (!vertices.some((v) => v.key === key)) {
        vertices.push({ ...vertex, key });
      }
    });

    for (let i = 0; i < keys.length; i++) {
      const keyA = keys[i];
      const keyB = keys[(i + 1) % keys.length];

      const edgeKey = [keyA, keyB].sort().join("_");

      if (!edges.some((edge) => edge.key === edgeKey)) {
        edges.push({
          key: edgeKey,
          from: keyA,
          to: keyB,
        });
      }

      addNeighbor(keyA, keyB);
    }
  });
}

function isAdjacentToSettlement(vertex) {
  const neighbors = vertexNeighbors[vertex.key] || [];

  return neighbors.some((neighborKey) => {
    return settlements.some((settlement) => settlement.key === neighborKey);
  });
}

function isConnectedToRoad(edge) {
  return roads.some((roadData) => {
    const road = edges.find((e) => e.key === roadData.key);

    if (!road) {
      return false;
    }

    return (
      edge.from === road.from ||
      edge.from === road.to ||
      edge.to === road.from ||
      edge.to === road.to
    );
  });
}

function canBuildRoad(edge) {
  const connectedToSettlement =
    settlements.some((settlement) => settlement.key === edge.from) ||
    settlements.some((settlement) => settlement.key === edge.to);

  const connectedToRoad = isConnectedToRoad(edge);

  return connectedToSettlement || connectedToRoad;
}

function renderEdges() {
  edges.forEach((edge) => {
    const from = vertices.find((v) => v.key === edge.from);
    const to = vertices.find((v) => v.key === edge.to);

    if (!from || !to) {
      return;
    }

    const line = document.createElement("div");
    line.className = "edge";

    const road = roads.find((r) => r.key === edge.key);

    if (road) {
      line.classList.add("road", `player-${road.player}`);
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    line.style.width = `${length}px`;
    line.style.left = `${from.x}px`;
    line.style.top = `${from.y}px`;
    line.style.transform = `rotate(${angle}deg)`;

    line.addEventListener("click", () => {
      if (isCurrentPlayerCpu()) {
        return;
      }
      if (phase === "main" && !hasRolledDice) {
        alert("サイコロを振ってから建設してください。");
        return;
      }
      const player = getCurrentPlayer();

      if (phase === "setup" && setupStep !== "road") {
        alert("今は開拓地を置く番です。");
        return;
      }

      if (roads.some((r) => r.key === edge.key)) return;

      if (
        phase === "setup" &&
        edge.from !== lastSetupSettlementKey &&
        edge.to !== lastSetupSettlementKey
      ) {
        alert("直前に置いた開拓地につながる道だけ置けます。");
        return;
      }

      // ★セットアップ中は制限なし
      if (phase !== "setup") {
        if (!canBuildRoad(edge)) {
          alert("接続必要");
          return;
        }

        if (freeRoadBuildCount > 0) {
          freeRoadBuildCount--;
        } else {
          if (!hasResources(player, COSTS.road)) {
            alert("資源不足");
            return;
          }

          consumeResources(player, COSTS.road);
        }
      }
      roads.push({
        key: edge.key,
        player: player,
      });

      updateLongestRoad();
      updateScoresDisplay();
      checkWinner();

      // ★セットアップ進行
      if (phase === "setup") {
        setupStep = "settlement";
        setupIndex++;

        if (setupIndex >= setupTurnOrder.length) {
          phase = "main";
        }
      }

      renderBoard();
      updateCurrentPlayerText();
      runCpuTurnIfNeeded();
    });
    board.appendChild(line);
  });
}

function renderVertices() {
  vertices.forEach((vertex) => {
    const point = document.createElement("div");
    point.className = "vertex";

    const settlement = settlements.find((s) => s.key === vertex.key);

    if (settlement) {
      point.classList.add(settlement.type, `player-${settlement.player}`);
    }

    point.style.left = `${vertex.x}px`;
    point.style.top = `${vertex.y}px`;

    point.addEventListener("click", () => {
      if (isCurrentPlayerCpu()) {
        return;
      }
      const player = getCurrentPlayer();

      const existingSettlement = settlements.find((s) => s.key === vertex.key);

      // すでに開拓地・都市がある場合 → 都市化
      if (existingSettlement) {
        if (phase === "setup") {
          alert("初期配置中は都市にできません。");
          return;
        }

        if (!hasRolledDice) {
          alert("サイコロを振ってから都市にしてください。");
          return;
        }

        if (existingSettlement.player !== player) {
          alert("他のプレイヤーの開拓地は都市にできません。");
          return;
        }

        if (existingSettlement.type === "city") {
          alert("すでに都市です。");
          return;
        }

        if (!hasResources(player, COSTS.city)) {
          alert("資源が足りません（麦2・鉄3が必要）");
          return;
        }

        consumeResources(player, COSTS.city);
        existingSettlement.type = "city";

        updateScoresDisplay();
        checkWinner();
        renderBoard();
        return;
      }

      // setup中なのに道の番なら、開拓地は置けない
      if (phase === "setup" && setupStep !== "settlement") {
        alert("今は道を置く番です。");
        return;
      }

      // main中はサイコロ後だけ新規開拓地OK
      if (phase === "main" && !hasRolledDice) {
        alert("サイコロを振ってから建設してください。");
        return;
      }

      // 隣接チェック
      if (isAdjacentToSettlement(vertex)) {
        alert("隣り合う頂点には開拓地を置けません。");
        return;
      }

      // main中だけ資源チェック
      if (phase === "main") {
        if (!hasResources(player, COSTS.settlement)) {
          alert("資源不足");
          return;
        }

        consumeResources(player, COSTS.settlement);
      }

      settlements.push({
        key: vertex.key,
        player: player,
        type: "settlement",
      });

      updateScoresDisplay();
      checkWinner();

      lastSetupSettlementKey = vertex.key;

      if (phase === "setup" && setupIndex >= 4) {
        giveInitialResources({
          key: vertex.key,
          player: player,
        });
      }

      if (phase === "setup") {
        setupStep = "road";
      }

      renderBoard();
      updateCurrentPlayerText();
      runCpuTurnIfNeeded();
    });

    board.appendChild(point);
  });
}
function renderBoard() {
  board.innerHTML = "";

  let tileIndex = 0;
  const tilePositions = [];

  rowCounts.forEach((count, rowIndex) => {
    const rowWidth = count * HEX_WIDTH;
    const startX = (board.clientWidth - rowWidth) / 2;
    const y = rowIndex * VERTICAL_SPACING;

    for (let col = 0; col < count; col++) {
      const tile = tiles[tileIndex];

      const hex = document.createElement("div");

      const currentTileIndex = tileIndex;
      hex.className = `hex ${tile.type}`;

      if (isRobberMoving && currentTileIndex !== robberTileIndex) {
        hex.classList.add("robber-selectable");
      }
      if (currentTileIndex === robberTileIndex) {
        hex.classList.add("robber");
      }

      hex.addEventListener("click", () => {
        if (isCurrentPlayerCpu()) {
          return;
        }
        if (!isRobberMoving) return;

        robberTileIndex = currentTileIndex;

        isRobberMoving = false;
        const targetPlayers = getPlayersAdjacentToTile(currentTileIndex);

        if (targetPlayers.length === 0) {
          alert("奪える相手がいません。");
        } else {
          if (targetPlayers.length === 1) {
            stealRandomResource(targetPlayers[0], getCurrentPlayer());
          } else {
            choosePlayerToStealByButton(targetPlayers, (targetPlayer) => {
              stealRandomResource(targetPlayer, getCurrentPlayer());
              renderBoard();
            });

            return;
          }
        }
        renderBoard();
      });
      hex.innerHTML = `
  <div class="resource">${tile.label}</div>
  ${
    tile.number
      ? `<div class="number-chip">${tile.number}</div>`
      : `<div class="number-chip empty">砂</div>`
  }
  ${currentTileIndex === robberTileIndex ? `<div class="robber-icon">👿</div>` : ""}
`;
      const x = startX + col * HORIZONTAL_SPACING;

      hex.style.left = `${x}px`;
      hex.style.top = `${y}px`;

      board.appendChild(hex);

      tilePositions.push({ x, y });

      tileIndex++;
    }
  });

  buildBoardGraph(tilePositions);
  renderEdges();
  renderVertices();
  renderPorts();
}

function highlightTiles(number) {
  const hexes = document.querySelectorAll(".hex");

  hexes.forEach((hex, index) => {
    hex.classList.remove("active");

    if (tiles[index].number === number) {
      hex.classList.add("active");
    }
  });
}

function rollDice() {
  if (isRobberMoving) {
    alert("盗賊を移動してください。");
    return;
  }
  if (discardState !== null) {
    alert("まだ資源を捨てています。");
    return;
  }
  if (phase === "setup") {
    alert("初期配置が終わるまでサイコロは振れません。");
    return;
  }

  if (hasRolledDice) {
    alert("このターンはすでにサイコロを振っています。");
    return;
  }

  hasRolledDice = true; // ★ここ
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const total = dice1 + dice2;

  diceResult.textContent = `結果: ${dice1} + ${dice2} = ${total}`;

  if (total === 7) {
    alert(
      `7発生\n` +
        `現在プレイヤー:${players[getCurrentPlayer()]}\n` +
        `人間:${players[humanPlayerIndex]}\n` +
        `isCpu:${isCurrentPlayerCpu()}`,
    );

    handleRobber();
    return;
  }
  highlightTiles(total);
  giveResourcesByDice(total);
}
function updateCurrentPlayerText() {
  const playerIndex = getCurrentPlayer();
  const player = players[playerIndex];
  const typeText = isCpuPlayer(playerIndex) ? "CPU" : "あなた";

  currentPlayerText.textContent = `現在のプレイヤー: ${player}（${typeText} / ${phase} / ${setupStep}）`;

  updateActionButtons();
}
function getAvailableSetupSettlementVertices() {
  return vertices.filter((vertex) => {
    return canPlaceSettlementAtVertex(vertex.key);
  });
}
function getNumberScore(number) {
  const scores = {
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    8: 5,
    9: 4,
    10: 3,
    11: 2,
    12: 1,
  };

  return scores[number] || 0;
}
function canPlaceSettlementAtVertex(vertexKey) {
  const vertex = vertices.find((v) => v.key === vertexKey);
  if (!vertex) return false;

  const exists = settlements.some((s) => s.key === vertexKey);
  if (exists) return false;

  if (isAdjacentToSettlement(vertex)) return false;

  return true;
}

function getVertexResourceScore(vertexKey) {
  let score = 0;

  tiles.forEach((tile, tileIndex) => {
    if (tile.type === "desert") return;

    const tilePos = getTilePositionByIndex(tileIndex);
    const tileVertices = getHexVertices(tilePos.x, tilePos.y);
    const tileVertexKeys = tileVertices.map(getVertexKey);

    if (tileVertexKeys.includes(vertexKey)) {
      score += getNumberScore(tile.number);
    }
  });

  return score;
}
function getFutureSettlementVertexScore(vertexKey, player, distance) {
  if (!canPlaceSettlementAtVertex(vertexKey)) return 0;

  const numberScore = getVertexResourceScore(vertexKey);
  const portScore = getSmartPortScore(player, vertexKey, numberScore);

  const distanceBonus =
    distance === 1
      ? 8
      : distance === 2
        ? 6
        : distance === 3
          ? 3
          : distance === 4
            ? 1
            : 0;

  const score = numberScore * 10 + portScore + distanceBonus;

  console.log(
    "頂点",
    vertexKey,
    "距離",
    distance,
    "数字",
    numberScore,
    "港",
    portScore,
    "評価",
    score,
  );

  return score;
}
function getVertexResourceTypes(vertexKey) {
  const resourceTypes = [];

  tiles.forEach((tile, tileIndex) => {
    if (tile.type === "desert") return;

    const tilePos = getTilePositionByIndex(tileIndex);
    const tileVertices = getHexVertices(tilePos.x, tilePos.y);
    const tileVertexKeys = tileVertices.map(getVertexKey);

    if (tileVertexKeys.includes(vertexKey)) {
      resourceTypes.push(tile.label);
    }
  });

  return resourceTypes;
}
function getResourceBalanceScore(player, vertexKey) {
  const resourceTypes = getVertexResourceTypes(vertexKey);
  let score = 0;

  resourceTypes.forEach((resource) => {
    if (playerResources[player][resource] === 0) {
      score += 3;
    }
  });

  return score;
}
function getVertexTotalScore(player, vertexKey) {
  const numberScore = getVertexResourceScore(vertexKey);

  // 数字が弱すぎる港取りを防ぐ
  const portScore = getSmartPortScore(player, vertexKey, numberScore);

  return numberScore * 10 + portScore;
}
function getSmartPortScore(player, vertexKey, numberScore) {
  let totalScore = 0;

  ports.forEach((port) => {
    if (isPortOccupied(port)) return;

    const distance = getDistanceFromVertexToPort(vertexKey, port, 2);

    if (distance === Infinity) return;

    let portScore = 0;

    // 3:1港
    if (port.type === "any") {
      if (distance === 0) portScore += 25;
      if (distance === 1) portScore += 12;
    } else {
      // 専門港
      const resourcePower = getPlayerResourceProductionScore(player, port.type);

      if (resourcePower >= 8) {
        if (distance === 0) portScore += 30;
        if (distance === 1) portScore += 18;
        if (distance === 2) portScore += 8;
      }
    }

    // この港に向かう頂点の数字が弱すぎる場合、この港の点数だけ下げる
    if (numberScore <= 5) {
      portScore = Math.floor(portScore * 0.4);
    }

    totalScore += portScore;
  });

  return totalScore;
}
function isPortOccupied(port) {
  const edgeKey = getPortEdgeKey(port);
  if (!edgeKey) return false;

  const [keyA, keyB] = edgeKey.split("_");

  return settlements.some((settlement) => {
    return settlement.key === keyA || settlement.key === keyB;
  });
}
function getPlayerResourceProductionScore(player, resource) {
  let score = 0;

  settlements.forEach((settlement) => {
    if (settlement.player !== player) return;

    tiles.forEach((tile, tileIndex) => {
      if (tile.label !== resource) return;

      const tilePos = getTilePositionByIndex(tileIndex);
      const tileVertices = getHexVertices(tilePos.x, tilePos.y);
      const tileVertexKeys = tileVertices.map(getVertexKey);

      if (tileVertexKeys.includes(settlement.key)) {
        score += getNumberScore(tile.number);
      }
    });
  });

  return score;
}
function getDistanceFromVertexToPort(vertexKey, port, maxDistance) {
  const edgeKey = getPortEdgeKey(port);
  if (!edgeKey) return Infinity;

  const [portA, portB] = edgeKey.split("_");

  if (vertexKey === portA || vertexKey === portB) {
    return 0;
  }

  const queue = [{ vertexKey, distance: 0 }];
  const visited = new Set([vertexKey]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.distance >= maxDistance) continue;

    const neighbors = vertexNeighbors[current.vertexKey] || [];

    for (const neighborKey of neighbors) {
      if (visited.has(neighborKey)) continue;

      const nextDistance = current.distance + 1;

      if (neighborKey === portA || neighborKey === portB) {
        return nextDistance;
      }

      visited.add(neighborKey);

      queue.push({
        vertexKey: neighborKey,
        distance: nextDistance,
      });
    }
  }

  return Infinity;
}
function getPortScore(player, vertexKey) {
  let score = 0;

  ports.forEach((port) => {
    const edgeKey = getPortEdgeKey(port);
    if (!edgeKey) return;

    const [keyA, keyB] = edgeKey.split("_");

    if (vertexKey !== keyA && vertexKey !== keyB) {
      return;
    }

    if (port.type === "any") {
      score += 3;
      return;
    }

    if (playerResources[player][port.type] >= 2) {
      score += 4;
    } else {
      score += 2;
    }
  });

  return score;
}
function getAvailableSetupRoadEdges(settlementKey) {
  return edges.filter((edge) => {
    const exists = roads.some((r) => r.key === edge.key);
    if (exists) return false;

    return edge.from === settlementKey || edge.to === settlementKey;
  });
}

function cpuPlaceSetupSettlement() {
  const player = getCurrentPlayer();
  const candidates = getAvailableSetupSettlementVertices();

  if (candidates.length === 0) {
    logCpuAction("CPUが置ける開拓地がありません");
    return;
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    return (
      getVertexResourceScore(b.key) +
      getResourceBalanceScore(player, b.key) +
      getPortScore(player, b.key) -
      (getVertexResourceScore(a.key) +
        getResourceBalanceScore(player, a.key) +
        getPortScore(player, a.key))
    );
  });
  const topCandidates = sortedCandidates.slice(0, 3);

  const vertex =
    topCandidates[Math.floor(Math.random() * topCandidates.length)];
  settlements.push({
    key: vertex.key,
    player,
    type: "settlement",
  });

  lastSetupSettlementKey = vertex.key;

  if (setupIndex >= 4) {
    giveInitialResources({
      key: vertex.key,
      player,
    });
  }

  setupStep = "road";

  updateScoresDisplay();
  renderBoard();
  updateCurrentPlayerText();
}

function cpuPlaceSetupRoad() {
  const player = getCurrentPlayer();
  const candidates = getAvailableSetupRoadEdges(lastSetupSettlementKey);

  if (candidates.length === 0) {
    logCpuAction("CPUが置ける道がありません");
    return;
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    return getRoadExpansionScore(b, player) - getRoadExpansionScore(a, player);
  });

  console.log(
    "初期配置 道候補",
    sortedCandidates.map((edge) => {
      return {
        edgeKey: edge.key,
        score: getRoadExpansionScore(edge, player),
      };
    }),
  );

  const bestScore = getRoadExpansionScore(sortedCandidates[0], player);

  const topCandidates = sortedCandidates.filter((edge) => {
    return bestScore - getRoadExpansionScore(edge, player) <= 1;
  });

  const edge = topCandidates[Math.floor(Math.random() * topCandidates.length)];
  roads.push({
    key: edge.key,
    player,
  });

  setupStep = "settlement";
  setupIndex++;

  if (setupIndex >= setupTurnOrder.length) {
    phase = "main";
  }

  updateLongestRoad();
  updateScoresDisplay();
  renderBoard();
  updateCurrentPlayerText();
}
function getSettlementScore(settlement) {
  return getVertexResourceScore(settlement.key);
}
function getCpuBuildableCitySettlement(player) {
  const candidates = settlements.filter((settlement) => {
    return settlement.player === player && settlement.type === "settlement";
  });

  if (candidates.length === 0) {
    return null;
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    return getSettlementScore(b) - getSettlementScore(a);
  });

  return sortedCandidates[0];
}
function getCpuBuildableSettlementVertex(player) {
  const candidates = vertices.filter((vertex) => {
    const exists = settlements.some((s) => s.key === vertex.key);
    if (exists) return false;

    if (isAdjacentToSettlement(vertex)) return false;

    const connectedRoad = roads.some((roadData) => {
      if (roadData.player !== player) return false;

      const road = edges.find((edge) => edge.key === roadData.key);
      if (!road) return false;

      return road.from === vertex.key || road.to === vertex.key;
    });

    return connectedRoad;
  });

  if (candidates.length === 0) {
    return null;
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    return (
      getVertexResourceScore(b.key) +
      getResourceBalanceScore(player, b.key) +
      getPortScore(player, b.key) -
      (getVertexResourceScore(a.key) +
        getResourceBalanceScore(player, a.key) +
        getPortScore(player, a.key))
    );
  });
  const topCandidates = sortedCandidates.slice(0, 3);

  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}
function getRoadExpansionScore(edge, player) {
  let bestScore = 0;

  const reachableVertices = getReachableVerticesAfterRoad(edge, player, 4);
  const minDistance = shouldIncludeDistanceOne(edge, player) ? 1 : 2;

  console.log("道候補", edge.key, reachableVertices);

  reachableVertices.forEach((item) => {
    const vertexKey = item.vertexKey;
    const distance = item.distance;

    if (distance < minDistance) return;

    const score = getFutureSettlementVertexScore(vertexKey, player, distance);

    if (score > bestScore) {
      bestScore = score;
    }
  });

  return bestScore;
}
function shouldIncludeDistanceOne(edge, player) {
  const startKey = getRoadStartVertex(edge, player);

  if (!startKey) return false;

  const ownSettlement = settlements.some((settlement) => {
    return settlement.player === player && settlement.key === startKey;
  });

  if (!ownSettlement) return true;

  const connectedOwnRoadCount = roads.filter((roadData) => {
    if (roadData.player !== player) return false;

    const road = edges.find((edge) => edge.key === roadData.key);
    if (!road) return false;

    return road.from === startKey || road.to === startKey;
  }).length;

  return connectedOwnRoadCount >= 1;
}
function getCpuBuildableRoadEdge(player) {
  const candidates = edges.filter((edge) => {
    const exists = roads.some((r) => r.key === edge.key);
    if (exists) return false;

    const connectedSettlement = settlements.some((settlement) => {
      return (
        settlement.player === player &&
        (settlement.key === edge.from || settlement.key === edge.to)
      );
    });

    const connectedRoad = roads.some((roadData) => {
      if (roadData.player !== player) return false;

      const road = edges.find((e) => e.key === roadData.key);
      if (!road) return false;

      return (
        edge.from === road.from ||
        edge.from === road.to ||
        edge.to === road.from ||
        edge.to === road.to
      );
    });

    if (!connectedSettlement && !connectedRoad) return false;

    // 追加：他プレイヤーとぶつかるだけの道は避ける
    if (shouldCpuAvoidContestedVertex(edge, player)) return false;

    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    return getRoadExpansionScore(b, player) - getRoadExpansionScore(a, player);
  });

  const bestScore = getRoadExpansionScore(sortedCandidates[0], player);

  const topCandidates = sortedCandidates.filter((edge) => {
    return bestScore - getRoadExpansionScore(edge, player) <= 1;
  });

  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}
function cpuBuildSomething() {
  if (!isCurrentPlayerCpu()) {
    console.warn("cpuBuildSomething中止：現在は人間ターン");
    return false;
  }
  const player = getCurrentPlayer();
  const strategy = getCpuStrategy(player);

  if (strategy === "city" && hasResources(player, COSTS.city)) {
    const settlement = getCpuBuildableCitySettlement(player);

    if (!settlement) {
      return false;
    }

    consumeResources(player, COSTS.city);
    settlement.type = "city";

    updateScoresDisplay();
    checkWinner();
    renderBoard();
    return true;
  }
  if (strategy === "settlement" && hasResources(player, COSTS.settlement)) {
    const vertex = getCpuBuildableSettlementVertex(player);

    if (vertex) {
      consumeResources(player, COSTS.settlement);

      settlements.push({
        key: vertex.key,
        player,
        type: "settlement",
      });

      updateScoresDisplay();
      checkWinner();
      renderBoard();
      return true;
    }
  }

  if (strategy === "road" && hasResources(player, COSTS.road)) {
    const edge = getCpuBuildableRoadEdge(player);

    if (edge) {
      consumeResources(player, COSTS.road);

      roads.push({
        key: edge.key,
        player,
      });

      updateLongestRoad();
      updateScoresDisplay();
      checkWinner();
      renderBoard();
      return true;
    }
  }
  return false;
}
function cpuBuyDevelopmentCardIfPossible() {
  if (!isCurrentPlayerCpu()) return false;
  const player = getCurrentPlayer();

  if (phase !== "main") return false;
  if (!hasRolledDice) return false;
  if (developmentDeck.length === 0) return false;
  if (!hasResources(player, DEV_COST)) return false;

  consumeResources(player, DEV_COST);

  const card = developmentDeck.pop();

  playerDevelopmentCards[player].push({
    type: card,
    canUse: false,
  });

  updateDevCardsDisplay();
  checkWinner();

  logCpuAction(`${players[player]}CPUが発展カードを購入しました`);

  return true;
}
function cpuUseKnightCardIfPossible() {
  if (!isCurrentPlayerCpu()) return false;
  const player = getCurrentPlayer();

  if (phase !== "main") return false;

  const cards = playerDevelopmentCards[player];

  const cardIndex = cards.findIndex((card) => {
    return card.type === "knight" && card.canUse;
  });

  if (cardIndex === -1) return false;

  if (!shouldCpuUseKnightCard(player)) {
    return false;
  }
  cards.splice(cardIndex, 1);

  knightCount[player]++;

  updateLargestArmy();
  updateScoresDisplay();
  checkWinner();

  handleRobber();

  updateDevCardsDisplay();

  logCpuAction(`${players[player]}CPUが騎士カードを使いました`);

  return true;
}
function getMostNeededResource(player) {
  const resources = playerResources[player];

  const priorities = ["麦", "鉄", "木", "土", "羊"];

  return (
    priorities.find((resource) => {
      return resources[resource] === 0;
    }) || priorities[0]
  );
}

function cpuUseYearOfPlentyCardIfPossible() {
  if (!isCurrentPlayerCpu()) return false;
  const player = getCurrentPlayer();

  if (phase !== "main") return false;

  const cards = playerDevelopmentCards[player];

  const cardIndex = cards.findIndex((card) => {
    return card.type === "year_of_plenty" && card.canUse;
  });

  if (cardIndex === -1) return false;

  const [resource1, resource2] = getBestYearOfPlentyResources(player);

  playerResources[player][resource1]++;
  playerResources[player][resource2]++;
  cards.splice(cardIndex, 1);

  updateResourcesDisplay();
  updateDevCardsDisplay();

  logCpuAction(`${players[player]}CPUが収穫カードを使いました`);

  return true;
}
function getBestYearOfPlentyResource(player) {
  const tradePlans = getCpuTradePlans(player);

  if (tradePlans.length === 0) {
    return getMostNeededResource(player);
  }

  const firstPlan = tradePlans[0];

  const receiveItems = getBestCpuReceiveItems(player, firstPlan.wantResources);

  if (!receiveItems) {
    return getMostNeededResource(player);
  }

  const resource = RESOURCES.find((resource) => {
    return receiveItems[resource] > 0;
  });

  return resource || getMostNeededResource(player);
}

function getBestYearOfPlentyResources(player) {
  const resource1 = getBestYearOfPlentyResource(player);

  playerResources[player][resource1]++;

  const resource2 = getBestYearOfPlentyResource(player);

  playerResources[player][resource1]--;

  return [resource1, resource2];
}

function getBestMonopolyResource(player) {
  let bestResource = null;
  let bestScore = -1;

  const tradePlans = getCpuTradePlans(player);

  RESOURCES.forEach((resource) => {
    let opponentTotal = 0;

    players.forEach((_, index) => {
      if (index === player) return;

      opponentTotal += playerResources[index][resource];
    });

    if (opponentTotal <= 0) return;

    let score = opponentTotal * 5;

    tradePlans.forEach((plan) => {
      const goalCost = getGoalCost(plan.goal);
      if (!goalCost) return;

      const beforeResources = playerResources[player];

      const afterResources = {
        ...beforeResources,
        [resource]: beforeResources[resource] + opponentTotal,
      };

      const beforeMissing = getMissingResourceTotal(beforeResources, goalCost);
      const afterMissing = getMissingResourceTotal(afterResources, goalCost);

      if (afterMissing === 0) {
        if (plan.goal === "city") score += 100;
        if (plan.goal === "settlement") score += 90;
        if (plan.goal === "road") score += 70;
        if (plan.goal === "development") score += 50;
      }

      if (afterMissing < beforeMissing) {
        const progress = beforeMissing - afterMissing;

        if (plan.goal === "city") score += 30 * progress;
        if (plan.goal === "settlement") score += 25 * progress;
        if (plan.goal === "road") score += 20 * progress;
        if (plan.goal === "development") score += 15 * progress;
      }
    });

    score += getResourceNeedScore(player, resource);

    if (score > bestScore) {
      bestScore = score;
      bestResource = resource;
    }
  });

  return bestResource;
}
function cpuUseMonopolyCardIfPossible() {
  if (!isCurrentPlayerCpu()) return false;
  const player = getCurrentPlayer();

  if (phase !== "main") return false;

  const cards = playerDevelopmentCards[player];

  const cardIndex = cards.findIndex((card) => {
    return card.type === "monopoly" && card.canUse;
  });

  if (cardIndex === -1) return false;

  const resource = getBestMonopolyResource(player);

  if (!resource) return false;

  let totalStolen = 0;

  players.forEach((_, index) => {
    if (index === player) return;

    const amount = playerResources[index][resource];

    playerResources[index][resource] = 0;
    playerResources[player][resource] += amount;

    totalStolen += amount;
  });

  cards.splice(cardIndex, 1);

  updateResourcesDisplay();
  updateDevCardsDisplay();

  logCpuAction(
    `${players[player]}CPUが${resource}を${totalStolen}枚独占しました`,
  );

  return true;
}
function cpuUseRoadBuildingCardIfPossible() {
  if (!isCurrentPlayerCpu()) return false;
  const player = getCurrentPlayer();

  if (phase !== "main") return false;

  const cards = playerDevelopmentCards[player];

  const cardIndex = cards.findIndex((card) => {
    return card.type === "road_building" && card.canUse;
  });

  if (cardIndex === -1) return false;

  const road1 = getCpuBuildableRoadEdge(player);

  if (!road1) return false;

  roads.push({
    key: road1.key,
    player,
  });

  updateLongestRoad();

  const road2 = getCpuBuildableRoadEdge(player);

  if (road2) {
    roads.push({
      key: road2.key,
      player,
    });

    updateLongestRoad();
  }

  cards.splice(cardIndex, 1);

  updateScoresDisplay();
  updateDevCardsDisplay();
  renderBoard();

  logCpuAction(`${players[player]}CPUが街道建設カードを使いました`);

  return true;
}
function getLeadingOpponent(player) {
  let bestPlayer = null;
  let bestScore = -1;

  players.forEach((_, index) => {
    if (index === player) return;

    const score = calculateScore(index);

    // 7点未満の相手は、優先妨害対象にしない
    if (score < 7) return;

    if (score > bestScore) {
      bestScore = score;
      bestPlayer = index;
    }
  });

  return bestPlayer;
}
function isRobberOnPlayerTile(player) {
  const targetPlayers = getPlayersAdjacentToTile(robberTileIndex);

  return targetPlayers.includes(player);
}

function countUsableKnightCards(player) {
  return playerDevelopmentCards[player].filter((card) => {
    return card.type === "knight" && card.canUse;
  }).length;
}

function shouldCpuUseKnightCard(player) {
  if (isRobberOnPlayerTile(player)) {
    return true;
  }

  if (countUsableKnightCards(player) >= 2) {
    return true;
  }

  return false;
}
function cpuMoveRobberIfNeeded() {
  if (!isCurrentPlayerCpu()) return false;
  if (!isRobberMoving) return false;

  const currentPlayer = getCurrentPlayer();

  const candidateTiles = tiles
    .map((tile, index) => {
      return { tile, index };
    })
    .filter((item) => {
      if (item.index === robberTileIndex) return false;

      const adjacentPlayers = getPlayersAdjacentToTile(item.index);

      return adjacentPlayers.some((playerIndex) => {
        return playerIndex !== currentPlayer;
      });
    });

  if (candidateTiles.length === 0) {
    const fallbackIndex = tiles.findIndex((_, index) => {
      return index !== robberTileIndex;
    });

    if (fallbackIndex === -1) {
      isRobberMoving = false;
      return false;
    }

    robberTileIndex = fallbackIndex;
    isRobberMoving = false;
    renderBoard();
    return true;
  }

  const selectedTile =
    candidateTiles[Math.floor(Math.random() * candidateTiles.length)];

  robberTileIndex = selectedTile.index;
  isRobberMoving = false;

  const targetPlayers = getPlayersAdjacentToTile(robberTileIndex);

  if (targetPlayers.length > 0) {
    const leadingOpponent = getLeadingOpponent(currentPlayer);

    const targetPlayer = targetPlayers.includes(leadingOpponent)
      ? leadingOpponent
      : targetPlayers[Math.floor(Math.random() * targetPlayers.length)];

    stealRandomResource(targetPlayer, currentPlayer);
  }

  diceResult.textContent = "CPUが盗賊を移動しました";
  renderBoard();

  return true;
}
function getMissingResources(resources, cost) {
  return Object.keys(cost).filter((resource) => {
    return resources[resource] < cost[resource];
  });
}

function getMissingResourceTotal(resources, cost) {
  return Object.keys(cost).reduce((total, resource) => {
    return total + Math.max(0, cost[resource] - resources[resource]);
  }, 0);
}

function getGoalCost(goal) {
  if (goal === "city") return COSTS.city;
  if (goal === "settlement") return COSTS.settlement;
  if (goal === "road") return COSTS.road;
  if (goal === "development") return DEV_COST;

  return null;
}

function getCpuTradePlans(player) {
  const resources = playerResources[player];
  const plans = [];

  if (hasUpgradeableSettlement(player)) {
    const missingCity = getMissingResources(resources, COSTS.city);

    if (missingCity.length > 0) {
      plans.push({
        goal: "city",
        wantResources: missingCity,
      });
    }
  }

  if (getCpuBuildableSettlementVertex(player) !== null) {
    const missingSettlement = getMissingResources(resources, COSTS.settlement);

    if (missingSettlement.length > 0) {
      plans.push({
        goal: "settlement",
        wantResources: missingSettlement,
      });
    }
  }

  if (getCpuBuildableRoadEdge(player) !== null) {
    const missingRoad = getMissingResources(resources, COSTS.road);

    if (missingRoad.length > 0) {
      plans.push({
        goal: "road",
        wantResources: missingRoad,
      });
    }
  }

  const missingDev = getMissingResources(resources, DEV_COST);

  if (missingDev.length > 0) {
    plans.push({
      goal: "development",
      wantResources: missingDev,
    });
  }

  return plans;
}

function getTradeGivePriorityForGoal(player, goal) {
  const resources = playerResources[player];
  const goalCost = getGoalCost(goal);

  if (!goalCost) {
    return RESOURCES.filter((resource) => resources[resource] > 0);
  }

  return RESOURCES.filter((resource) => {
    return resources[resource] > 0;
  }).sort((a, b) => {
    const aNeededForGoal = goalCost[a] || 0;
    const bNeededForGoal = goalCost[b] || 0;

    const aExtra = resources[a] - aNeededForGoal;
    const bExtra = resources[b] - bNeededForGoal;

    if (aExtra !== bExtra) {
      return bExtra - aExtra;
    }

    return getResourceNeedScore(player, a) - getResourceNeedScore(player, b);
  });
}

function isTradeProgressForGoal(player, goal, giveItems, receiveItems) {
  const goalCost = getGoalCost(goal);

  if (!goalCost) return false;

  const beforeResources = playerResources[player];
  const afterResources = getResourcesAfterTrade(
    player,
    giveItems,
    receiveItems,
  );

  const hasNegativeResource = RESOURCES.some((resource) => {
    return afterResources[resource] < 0;
  });

  if (hasNegativeResource) return false;

  const beforeMissing = getMissingResourceTotal(beforeResources, goalCost);
  const afterMissing = getMissingResourceTotal(afterResources, goalCost);

  return afterMissing < beforeMissing;
}
function getBestCpuReceiveItems(cpuPlayer, wantResources) {
  let bestCpuReceiveItems = null;
  let bestPriority = -1;

  const tradePlans = getCpuTradePlans(cpuPlayer);

  wantResources.forEach((resource) => {
    const cpuReceiveItems = {
      木: 0,
      麦: 0,
      羊: 0,
      土: 0,
      鉄: 0,
    };

    cpuReceiveItems[resource] = 1;

    let priority = 0;

    tradePlans.forEach((plan) => {
      const goalCost = getGoalCost(plan.goal);
      if (!goalCost) return;

      const beforeResources = playerResources[cpuPlayer];

      const afterResources = getResourcesAfterTrade(
        cpuPlayer,
        { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
        cpuReceiveItems,
      );

      const beforeMissing = getMissingResourceTotal(beforeResources, goalCost);
      const afterMissing = getMissingResourceTotal(afterResources, goalCost);

      if (afterMissing === 0) {
        if (plan.goal === "city") priority += 100;
        if (plan.goal === "settlement") priority += 90;
        if (plan.goal === "road") priority += 70;
        if (plan.goal === "development") priority += 50;
      }

      if (afterMissing < beforeMissing) {
        const progress = beforeMissing - afterMissing;

        if (plan.goal === "city") priority += 30 * progress;
        if (plan.goal === "settlement") priority += 25 * progress;
        if (plan.goal === "road") priority += 20 * progress;
        if (plan.goal === "development") priority += 15 * progress;
      }
    });

    priority += getResourceNeedScore(cpuPlayer, resource);

    if (priority > bestPriority) {
      bestPriority = priority;
      bestCpuReceiveItems = cpuReceiveItems;
    }
  });

  return bestCpuReceiveItems;
}
function createTradeItems(resource, count) {
  const items = { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 };
  items[resource] = count;
  return items;
}
function getResourcesAfterTrade(player, giveItems, receiveItems) {
  const currentResources = playerResources[player];

  const nextResources = {
    木: currentResources.木,
    麦: currentResources.麦,
    羊: currentResources.羊,
    土: currentResources.土,
    鉄: currentResources.鉄,
  };

  RESOURCES.forEach((resource) => {
    nextResources[resource] -= giveItems[resource] || 0;
    nextResources[resource] += receiveItems[resource] || 0;
  });

  return nextResources;
}
function getTradeValueForPlayer(player, tradeItems) {
  let value = 0;

  RESOURCES.forEach((resource) => {
    const count = tradeItems[resource];

    if (count <= 0) return;

    value += getResourceNeedScore(player, resource) * count;
  });

  return value;
}
function getCpuTradeGoal(player, giveItems, receiveItems) {
  const afterResources = getResourcesAfterTrade(
    player,
    giveItems,
    receiveItems,
  );

  if (
    hasUpgradeableSettlement(player) &&
    hasResourcesInSet(afterResources, COSTS.city)
  ) {
    return "city";
  }

  if (
    getCpuBuildableSettlementVertex(player) !== null &&
    hasResourcesInSet(afterResources, COSTS.settlement)
  ) {
    return "settlement";
  }

  if (
    getCpuBuildableRoadEdge(player) !== null &&
    hasResourcesInSet(afterResources, COSTS.road)
  ) {
    return "road";
  }

  if (hasResourcesInSet(afterResources, DEV_COST)) {
    return "development";
  }

  return "none";
}
function isTradeUsefulForCpu(player, giveItems, receiveItems) {
  const goal = getCpuTradeGoal(player, giveItems, receiveItems);

  if (goal === "none") {
    return false;
  }

  const afterResources = getResourcesAfterTrade(
    player,
    giveItems,
    receiveItems,
  );

  const hasNegativeResource = RESOURCES.some((resource) => {
    return afterResources[resource] < 0;
  });

  if (hasNegativeResource) {
    return false;
  }

  return true;
}

function cpuProposeTradeIfPossible() {
  if (!isCurrentPlayerCpu()) return "failed";

  const cpuPlayer = getCurrentPlayer();
  const cpuResources = playerResources[cpuPlayer];

  const tradePlans = getCpuTradePlans(cpuPlayer);

  if (tradePlans.length === 0) {
    return "failed";
  }

  let selectedPlan = null;
  let selectedGiveItems = null;
  let selectedReceiveItems = null;

  for (const tradePlan of tradePlans) {
    const cpuReceiveItems = getBestCpuReceiveItems(
      cpuPlayer,
      tradePlan.wantResources,
    );

    if (!cpuReceiveItems) continue;

    const giveCandidates = getCpuGiveCandidates(cpuPlayer, tradePlan.goal);

    for (const testGiveItems of giveCandidates) {
      if (
        isTradeProgressForGoal(
          cpuPlayer,
          tradePlan.goal,
          testGiveItems,
          cpuReceiveItems,
        )
      ) {
        selectedPlan = tradePlan;
        selectedGiveItems = testGiveItems;
        selectedReceiveItems = cpuReceiveItems;
        break;
      }
    }

    if (selectedPlan) break;
  }

  if (!selectedPlan) {
    return "failed";
  }

  const cpuGiveItems = selectedGiveItems;
  const cpuReceiveItems = selectedReceiveItems;

  const candidates = players
    .map((_, index) => index)
    .filter((targetPlayer) => {
      if (targetPlayer === cpuPlayer) return false;

      const targetScore = calculateScore(targetPlayer);
      if (targetScore >= 8) return false;

      const targetResources = playerResources[targetPlayer];

      return RESOURCES.every((resource) => {
        return targetResources[resource] >= cpuReceiveItems[resource];
      });
    });

  if (candidates.length === 0) {
    logCpuAction(`${players[cpuPlayer]}CPUの交渉相手がいません`);
    return "failed";
  }

  const humanTargets = candidates.filter((targetPlayer) => {
    return !isCpuPlayer(targetPlayer);
  });

  if (humanTargets.length > 0) {
    const targetPlayer = humanTargets[0];

    pendingCpuTrade = {
      cpuPlayer,
      targetPlayer,
      cpuGiveItems,
      cpuReceiveItems,
    };

    showCpuTradeOffer(cpuPlayer, targetPlayer, cpuGiveItems, cpuReceiveItems);

    return "pending";
  }

  const acceptedCpuPlayers = candidates.filter((targetPlayer) => {
    return cpuAcceptTrade(targetPlayer, cpuGiveItems, cpuReceiveItems);
  });

  if (acceptedCpuPlayers.length === 0) {
    logCpuAction(`${players[cpuPlayer]}CPUの交渉は成立しませんでした`);
    return "failed";
  }

  const targetPlayer =
    acceptedCpuPlayers[Math.floor(Math.random() * acceptedCpuPlayers.length)];

  const targetResources = playerResources[targetPlayer];

  RESOURCES.forEach((resource) => {
    cpuResources[resource] -= cpuGiveItems[resource];
    targetResources[resource] += cpuGiveItems[resource];

    targetResources[resource] -= cpuReceiveItems[resource];
    cpuResources[resource] += cpuReceiveItems[resource];
  });

  updateResourcesDisplay();

  logCpuAction(
    `${players[cpuPlayer]}CPUが ${players[targetPlayer]}と ${tradeItemsToText(
      cpuGiveItems,
    )} ↔ ${tradeItemsToText(cpuReceiveItems)} の交渉を成立させました`,
  );

  return "success";
}
function cpuTradeWithBankIfPossible() {
  if (!isCurrentPlayerCpu()) return false;
  const player = getCurrentPlayer();
  const resources = playerResources[player];

  const tradePlans = getCpuTradePlans(player);

  if (tradePlans.length === 0) {
    return false;
  }

  for (const tradePlan of tradePlans) {
    const receiveItems = getBestCpuReceiveItems(
      player,
      tradePlan.wantResources,
    );

    if (!receiveItems) continue;

    const receiveResource = RESOURCES.find((resource) => {
      return receiveItems[resource] > 0;
    });

    if (!receiveResource) continue;

    const giveResources = getTradeGivePriorityForGoal(player, tradePlan.goal);

    for (const giveResource of giveResources) {
      const rate = getTradeRate(player, giveResource);

      if (resources[giveResource] < rate) continue;

      const giveItems = createTradeItems(giveResource, rate);
      const receiveItemsForBank = createTradeItems(receiveResource, 1);

      if (
        !isTradeProgressForGoal(
          player,
          tradePlan.goal,
          giveItems,
          receiveItemsForBank,
        )
      ) {
        continue;
      }

      resources[giveResource] -= rate;
      resources[receiveResource]++;

      updateResourcesDisplay();

      logCpuAction(
        `${players[player]}CPUが銀行交換：${giveResource}${rate}枚 → ${receiveResource}1枚`,
      );

      return true;
    }
  }

  return false;
}
function getCpuGiveCandidates(player, goal) {
  const resources = playerResources[player];
  const giveResources = getTradeGivePriorityForGoal(player, goal);
  const candidates = [];

  giveResources.forEach((resource) => {
    if (resources[resource] >= 1) {
      candidates.push(createTradeItems(resource, 1));
    }
  });

  giveResources.forEach((resource) => {
    if (resources[resource] >= 2) {
      candidates.push(createTradeItems(resource, 2));
    }
  });

  return candidates;
}
function hasResourcesInSet(resources, cost) {
  return Object.keys(cost).every((resource) => {
    return resources[resource] >= cost[resource];
  });
}

function hasUpgradeableSettlement(player) {
  return settlements.some((settlement) => {
    return settlement.player === player && settlement.type === "settlement";
  });
}
function getTradeTargetPlayer(cpuPlayer) {
  const candidates = players
    .map((_, index) => index)
    .filter((index) => {
      return index !== cpuPlayer;
    });

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
function cpuTakeMainActions() {
  console.log(
    "cpuTakeMainActions実行",
    Date.now(),
    players[getCurrentPlayer()],
  );
  if (!isCurrentPlayerCpu()) {
    console.warn("cpuTakeMainActions中止：現在は人間ターン");
    return;
  }
  console.log("CPU行動開始:", players[getCurrentPlayer()]);

  let actionCount = 0;
  const MAX_ACTIONS = 10;

  while (actionCount < MAX_ACTIONS) {
    console.log("CPU action loop:", players[getCurrentPlayer()], actionCount);

    let actionHappened = false;

    const strategy = getCpuStrategy(getCurrentPlayer());
    console.log("strategy:", strategy);

    if (strategy === "trade") {
      console.log("trade開始");

      const tradeResult = cpuProposeTradeIfPossible();

      if (tradeResult === "pending") {
        console.log("人間の交渉返答待ち");
        return;
      }

      if (tradeResult === "success") {
        actionHappened = true;
      }

      console.log("trade終了", tradeResult);

      if (tradeResult !== "success") {
        console.log("bank trade開始");

        const tradedWithBank = cpuTradeWithBankIfPossible();

        if (tradedWithBank) {
          actionHappened = true;
        }

        console.log("bank trade終了", tradedWithBank);
      }
    } else {
      console.log("build開始");

      const built = cpuBuildSomething();

      if (built) {
        actionHappened = true;
      }

      console.log("build終了", built);
    }

    if (strategy === "development") {
      console.log("development購入開始");

      const boughtDevCard = cpuBuyDevelopmentCardIfPossible();

      if (boughtDevCard) {
        actionHappened = true;
      }

      console.log("development購入終了", boughtDevCard);
    }

    console.log("発展カード使用チェック開始");

    if (cpuUseMonopolyCardIfPossible()) actionHappened = true;
    if (cpuUseYearOfPlentyCardIfPossible()) actionHappened = true;
    if (cpuUseRoadBuildingCardIfPossible()) actionHappened = true;
    if (cpuUseKnightCardIfPossible()) actionHappened = true;

    console.log("発展カード使用チェック終了");

    if (!actionHappened) {
      break;
    }

    actionCount++;
  }

  console.log("CPU行動終了:", players[getCurrentPlayer()]);
}
function updateActionButtons() {
  const isCpuTurn = isCurrentPlayerCpu();

  rollButton.disabled = isCpuTurn;
  nextTurnButton.disabled = isCpuTurn;

  document.getElementById("buy-dev-card").disabled = isCpuTurn;
  document.getElementById("use-knight").disabled = isCpuTurn;
  document.getElementById("use-year-of-plenty").disabled = isCpuTurn;
  document.getElementById("use-monopoly").disabled = isCpuTurn;
  document.getElementById("use-road-building").disabled = isCpuTurn;
  document.getElementById("open-trade").disabled = isCpuTurn;
}
function finishCurrentCpuTurn() {
  clearPendingCpuTrade();

  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  hasRolledDice = false;

  playerDevelopmentCards[currentPlayerIndex].forEach((card) => {
    card.canUse = true;
  });

  updateCurrentPlayerText();
  updateDevCardsDisplay();
  setCpuStatus("");

  runCpuTurnIfNeeded();
}
function setCpuStatus(message) {
  cpuStatus.textContent = message;
}
function logCpuAction(message) {
  setCpuStatus(message);
  console.log(message);
}
function runCpuTurnIfNeeded() {
  console.log(
    "runCpuTurnIfNeeded開始",
    Date.now(),
    players[getCurrentPlayer()],
    "phase:",
    phase,
  );
  console.log(
    "runCpuTurnIfNeeded確認",
    "current:",
    getCurrentPlayer(),
    "色:",
    players[getCurrentPlayer()],
    "humanPlayerIndex:",
    humanPlayerIndex,
    "人間の色:",
    players[humanPlayerIndex],
    "isCpu:",
    isCurrentPlayerCpu(),
    "phase:",
    phase,
    "hasRolledDice:",
    hasRolledDice,
    "isRobberMoving:",
    isRobberMoving,
  );

  if (!isCurrentPlayerCpu()) {
    setCpuStatus("");
    return;
  }
  setTimeout(() => {
    if (!isCurrentPlayerCpu()) {
      setCpuStatus("");
      return;
    }
    setCpuStatus(`${players[getCurrentPlayer()]}CPUが考え中...`);
    if (phase === "setup") {
      if (setupStep === "settlement") {
        cpuPlaceSetupSettlement();

        setTimeout(() => {
          runCpuTurnIfNeeded();
        }, CPU_ACTION_INTERVAL);

        return;
      }

      if (setupStep === "road") {
        cpuPlaceSetupRoad();

        setTimeout(() => {
          runCpuTurnIfNeeded();
        }, CPU_ACTION_INTERVAL);

        return;
      }
    }

    if (phase === "main") {
      if (!hasRolledDice) {
        rollDice();
      }

      setTimeout(() => {
        if (discardState !== null) {
          logCpuAction("破棄処理中なのでCPU停止");
          return;
        }

        if (isRobberMoving) {
          cpuMoveRobberIfNeeded();
        }
        cpuTakeMainActions();
        if (pendingCpuTrade !== null) {
          console.log("CPU交渉の返答待ちなのでターン終了しない");
          return;
        }
        setTimeout(() => {
          if (!isCurrentPlayerCpu()) {
            console.warn("CPUターン終了中止：現在は人間ターン");
            return;
          }

          if (discardState !== null || isRobberMoving) {
            console.warn("CPUターン終了中止：盗賊/破棄処理が未完了");
            return;
          }
          clearPendingCpuTrade();

          currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
          hasRolledDice = false;

          playerDevelopmentCards[currentPlayerIndex].forEach((card) => {
            card.canUse = true;
          });

          updateCurrentPlayerText();
          updateDevCardsDisplay();
          setCpuStatus("");

          runCpuTurnIfNeeded();
        }, CPU_ACTION_INTERVAL);
      }, CPU_THINK_TIME);
    }
  }, CPU_THINK_TIME);
}
function updateResourcesDisplay() {
  resourcesDiv.innerHTML = players
    .map((player, index) => {
      const r = playerResources[index];

      return `
        <div>
          ${player}：
          木${r.木} / 麦${r.麦} / 羊${r.羊} / 土${r.土} / 鉄${r.鉄}
        </div>
      `;
    })
    .join("");
}

function giveResourcesByDice(number) {
  tiles.forEach((tile, tileIndex) => {
    if (
      tile.number !== number ||
      tile.type === "desert" ||
      tileIndex === robberTileIndex // ★ここ追加
    ) {
      return;
    }
    const tilePosition = getTilePositionByIndex(tileIndex);
    const tileVertices = getHexVertices(tilePosition.x, tilePosition.y);
    const tileVertexKeys = tileVertices.map(getVertexKey);

    settlements.forEach((settlement) => {
      if (tileVertexKeys.includes(settlement.key)) {
        const amount = settlement.type === "city" ? 2 : 1;
        playerResources[settlement.player][tile.label] += amount;
      }
    });
  });

  updateResourcesDisplay();
}

function getTilePositionByIndex(targetIndex) {
  let tileIndex = 0;

  for (let rowIndex = 0; rowIndex < rowCounts.length; rowIndex++) {
    const count = rowCounts[rowIndex];
    const rowWidth = count * HEX_WIDTH;
    const startX = (board.clientWidth - rowWidth) / 2;
    const y = rowIndex * VERTICAL_SPACING;

    for (let col = 0; col < count; col++) {
      if (tileIndex === targetIndex) {
        return {
          x: startX + col * HORIZONTAL_SPACING,
          y,
        };
      }

      tileIndex++;
    }
  }

  return null;
}

function hasResources(playerIndex, cost) {
  const resources = playerResources[playerIndex];

  return Object.keys(cost).every((key) => {
    return resources[key] >= cost[key];
  });
}

function consumeResources(playerIndex, cost) {
  const resources = playerResources[playerIndex];

  Object.keys(cost).forEach((key) => {
    resources[key] -= cost[key];
  });

  updateResourcesDisplay();
}

function getCurrentPlayer() {
  if (phase === "setup") {
    return setupTurnOrder[setupIndex];
  }
  return currentPlayerIndex;
}
function giveInitialResources(settlement) {
  const vertex = vertices.find((v) => v.key === settlement.key);

  if (!vertex) return;

  tiles.forEach((tile, tileIndex) => {
    if (tile.type === "desert") return;

    const tilePos = getTilePositionByIndex(tileIndex);
    const tileVertices = getHexVertices(tilePos.x, tilePos.y);
    const tileVertexKeys = tileVertices.map(getVertexKey);

    if (tileVertexKeys.includes(settlement.key)) {
      playerResources[settlement.player][tile.label]++;
    }
  });

  updateResourcesDisplay();
}

function calculateScore(playerIndex) {
  let score = settlements
    .filter((s) => s.player === playerIndex)
    .reduce((total, settlement) => {
      if (settlement.type === "city") {
        return total + 2;
      }

      return total + 1;
    }, 0);

  const victoryPointCards = playerDevelopmentCards[playerIndex].filter(
    (card) => {
      return card.type === "victory";
    },
  ).length;

  score += victoryPointCards;

  if (largestArmyOwner === playerIndex) {
    score += 2;
  }

  if (longestRoadOwner === playerIndex) {
    score += 2;
  }

  return score;
}
function updateScoresDisplay() {
  scoresDiv.innerHTML = players
    .map((player, index) => {
      const largestArmyText = largestArmyOwner === index ? " / 最大騎士" : "";

      const longestRoadText = longestRoadOwner === index ? " / 最大交易路" : "";

      return `${player}: ${calculateScore(index)}点 / 最長${calculateLongestRoad(index)}本${largestArmyText}${longestRoadText}`;
    })
    .join(" / ");
}
function checkWinner() {
  const winnerIndex = players.findIndex((_, index) => {
    return calculateScore(index) >= 10;
  });

  if (winnerIndex !== -1) {
    alert(`${players[winnerIndex]}の勝利です！`);
  }
}
function handleRobber() {
  alert("7が出ました！");

  const discardQueue = [];

  playerResources.forEach((res, index) => {
    const total = res.木 + res.麦 + res.羊 + res.土 + res.鉄;

    if (total > 7) {
      discardQueue.push({
        playerIndex: index,
        discardCount: Math.floor(total / 2),
      });
    }
  });

  processDiscardQueue(discardQueue);
}
function stealRandomResource(fromPlayerIndex, toPlayerIndex) {
  const resources = playerResources[fromPlayerIndex];
  const resourceList = [];

  Object.keys(resources).forEach((key) => {
    for (let i = 0; i < resources[key]; i++) {
      resourceList.push(key);
    }
  });

  if (resourceList.length === 0) {
    alert(`${players[fromPlayerIndex]}は資源を持っていません。`);
    return;
  }

  const randomIndex = Math.floor(Math.random() * resourceList.length);
  const stolenResource = resourceList[randomIndex];

  playerResources[fromPlayerIndex][stolenResource]--;
  playerResources[toPlayerIndex][stolenResource]++;

  updateResourcesDisplay();

  alert(
    `${players[toPlayerIndex]}が${players[fromPlayerIndex]}から${stolenResource}を1枚奪いました。`,
  );
}

function getPlayersAdjacentToTile(tileIndex) {
  const tilePosition = getTilePositionByIndex(tileIndex);
  const tileVertices = getHexVertices(tilePosition.x, tilePosition.y);
  const tileVertexKeys = tileVertices.map(getVertexKey);

  const adjacentPlayers = settlements
    .filter((settlement) => tileVertexKeys.includes(settlement.key))
    .map((settlement) => settlement.player)
    .filter((playerIndex) => playerIndex !== getCurrentPlayer());

  return [...new Set(adjacentPlayers)];
}

function choosePlayerToSteal(targetPlayers) {
  if (targetPlayers.length === 1) {
    return targetPlayers[0];
  }

  const message = targetPlayers
    .map((playerIndex, index) => {
      return `${index + 1}: ${players[playerIndex]}`;
    })
    .join("\n");

  const input = prompt(`奪う相手を選んでください。\n${message}`);

  const selectedIndex = Number(input) - 1;

  if (
    Number.isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= targetPlayers.length
  ) {
    alert("正しく選択されなかったので、奪いません。");
    return null;
  }

  return targetPlayers[selectedIndex];
}
function cpuDiscardResources(playerIndex, discardCount) {
  let remaining = discardCount;
  const resources = playerResources[playerIndex];

  while (remaining > 0) {
    const availableResources = RESOURCES.filter((resource) => {
      return resources[resource] > 0;
    });

    if (availableResources.length === 0) {
      break;
    }

    const resource =
      availableResources[Math.floor(Math.random() * availableResources.length)];

    resources[resource]--;
    remaining--;
  }

  updateResourcesDisplay();

  logCpuAction(`${players[playerIndex]}CPUが${discardCount}枚捨てました`);
}
function discardResourcesByChoice(playerIndex, discardCount, onComplete) {
  discardState = {
    playerIndex,
    discardCount,
    selected: { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
    onComplete,
  };

  renderDiscardUI();
}
function renderDiscardUI() {
  if (!discardState) {
    discardArea.classList.add("hidden");
    discardArea.innerHTML = "";
    return;
  }

  const { playerIndex, discardCount, selected } = discardState;
  const res = playerResources[playerIndex];

  const selectedTotal = Object.values(selected).reduce((sum, n) => sum + n, 0);

  discardArea.classList.remove("hidden");

  discardArea.innerHTML = `
    <h3>${players[playerIndex]}：${discardCount}枚捨ててください</h3>
    <p>現在：木${res.木} / 麦${res.麦} / 羊${res.羊} / 土${res.土} / 鉄${res.鉄}</p>
    <p>選択中：木${selected.木} / 麦${selected.麦} / 羊${selected.羊} / 土${selected.土} / 鉄${selected.鉄}</p>
    <p>あと ${discardCount - selectedTotal} 枚</p>

    <div class="discard-buttons">
      <button data-resource="木">木を選ぶ</button>
      <button data-resource="麦">麦を選ぶ</button>
      <button data-resource="羊">羊を選ぶ</button>
      <button data-resource="土">土を選ぶ</button>
      <button data-resource="鉄">鉄を選ぶ</button>
    </div>

    <button id="discard-confirm-button">捨てる</button>
    <button id="discard-reset-button">選び直す</button>
  `;

  discardArea.querySelectorAll("[data-resource]").forEach((button) => {
    button.addEventListener("click", () => {
      const resource = button.dataset.resource;

      if (res[resource] <= selected[resource]) {
        alert(`${resource}はこれ以上選べません。`);
        return;
      }

      if (selectedTotal >= discardCount) {
        alert("必要枚数はすでに選んでいます。");
        return;
      }

      selected[resource]++;
      renderDiscardUI();
    });
  });

  document
    .getElementById("discard-reset-button")
    .addEventListener("click", () => {
      discardState.selected = { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 };
      renderDiscardUI();
    });

  document
    .getElementById("discard-confirm-button")
    .addEventListener("click", () => {
      const total = Object.values(selected).reduce((sum, n) => sum + n, 0);

      if (total !== discardCount) {
        alert(`${discardCount}枚ちょうど選んでください。`);
        return;
      }

      Object.keys(selected).forEach((key) => {
        res[key] -= selected[key];
      });

      updateResourcesDisplay();

      const callback = discardState.onComplete;
      discardState = null;
      renderDiscardUI();

      if (callback) {
        callback();
      }
    });
}

function processDiscardQueue(queue) {
  if (queue.length === 0) {
    isRobberMoving = true;
    diceResult.textContent = "盗賊を移動してください";
    renderBoard();

    if (isCurrentPlayerCpu()) {
      runCpuTurnIfNeeded();
    }

    return;
  }

  const { playerIndex, discardCount } = queue.shift();

  if (isCpuPlayer(playerIndex)) {
    cpuDiscardResources(playerIndex, discardCount);

    setTimeout(() => {
      processDiscardQueue(queue);
    }, 500);

    return;
  }

  discardResourcesByChoice(playerIndex, discardCount, () => {
    processDiscardQueue(queue);
  });
}
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

const DEV_COST = { 麦: 1, 羊: 1, 鉄: 1 };

function buyDevelopmentCard() {
  const player = getCurrentPlayer();

  if (phase !== "main") return;

  if (!hasRolledDice) {
    alert("サイコロ後に購入できます");
    return;
  }

  if (!hasResources(player, DEV_COST)) {
    alert("資源不足（麦・羊・鉄）");
    return;
  }

  if (developmentDeck.length === 0) {
    alert("カードがありません");
    return;
  }

  consumeResources(player, DEV_COST);

  const card = developmentDeck.pop();
  playerDevelopmentCards[player].push({
    type: card,
    canUse: false, // ★ここ重要
  });

  alert(`${players[player]}が発展カードを引きました`);
  updateDevCardsDisplay();
  checkWinner();
}

function useKnightCard() {
  const player = getCurrentPlayer();

  if (phase !== "main") return;

  const cards = playerDevelopmentCards[player];

  // 使える騎士カードを探す
  const index = cards.findIndex((c) => c.type === "knight" && c.canUse);

  if (index === -1) {
    alert("使える騎士カードがありません");
    return;
  }

  // 使用
  cards.splice(index, 1);

  knightCount[player]++;

  updateLargestArmy();
  updateScoresDisplay();
  checkWinner();

  alert("騎士カードを使用しました");

  // 盗賊発動（7と同じ処理）
  handleRobber();
}
function updateLargestArmy() {
  const currentOwner = largestArmyOwner;

  knightCount.forEach((count, index) => {
    if (count < 3) return;

    if (currentOwner === null) {
      if (largestArmyOwner === null || count > knightCount[largestArmyOwner]) {
        largestArmyOwner = index;
      }
      return;
    }

    if (index !== currentOwner && count > knightCount[currentOwner]) {
      largestArmyOwner = index;
    }
  });
}
function getPlayerRoadGraph(playerIndex) {
  const graph = {};

  roads.forEach((roadData) => {
    if (roadData.player !== playerIndex) return;

    const road = edges.find((e) => e.key === roadData.key);

    if (!road) return;

    if (!graph[road.from]) {
      graph[road.from] = [];
    }

    if (!graph[road.to]) {
      graph[road.to] = [];
    }

    graph[road.from].push({
      to: road.to,
      edgeKey: road.key,
    });

    graph[road.to].push({
      to: road.from,
      edgeKey: road.key,
    });
  });

  return graph;
}
function blocksRoadContinuation(vertexKey, playerIndex) {
  return settlements.some((settlement) => {
    return settlement.player !== playerIndex && settlement.key === vertexKey;
  });
}
function dfsLongestRoad(graph, currentVertex, usedEdges, playerIndex) {
  const neighbors = graph[currentVertex] || [];

  let maxLength = 0;

  neighbors.forEach((neighbor) => {
    if (usedEdges.has(neighbor.edgeKey)) {
      return;
    }

    usedEdges.add(neighbor.edgeKey);

    let nextLength = 1;

    if (!blocksRoadContinuation(neighbor.to, playerIndex)) {
      nextLength += dfsLongestRoad(
        graph,
        neighbor.to,
        new Set(usedEdges),
        playerIndex,
      );
    }

    if (nextLength > maxLength) {
      maxLength = nextLength;
    }
  });

  return maxLength;
}
function calculateLongestRoad(playerIndex) {
  const graph = getPlayerRoadGraph(playerIndex);

  let longest = 0;

  Object.keys(graph).forEach((vertexKey) => {
    const length = dfsLongestRoad(graph, vertexKey, new Set(), playerIndex);
    if (length > longest) {
      longest = length;
    }
  });

  return longest;
}
function countRoads(playerIndex) {
  return roads.filter((road) => road.player === playerIndex).length;
}
function updateLongestRoad() {
  const roadLengths = players.map((_, index) => {
    return calculateLongestRoad(index);
  });

  if (longestRoadOwner !== null) {
    const ownerLength = roadLengths[longestRoadOwner];

    const overtaker = roadLengths.findIndex((length, index) => {
      return index !== longestRoadOwner && length >= 5 && length > ownerLength;
    });

    if (overtaker !== -1) {
      longestRoadOwner = overtaker;
    }

    return;
  }

  let bestPlayer = null;
  let bestLength = 0;

  roadLengths.forEach((length, index) => {
    if (length < 5) return;

    if (length > bestLength) {
      bestLength = length;
      bestPlayer = index;
    }
  });

  if (bestPlayer !== null) {
    longestRoadOwner = bestPlayer;
  }
}
function choosePlayerToStealByButton(targetPlayers, onSelect) {
  stealArea.classList.remove("hidden");

  stealArea.innerHTML = `
    <h3>奪う相手を選んでください</h3>
    <div class="steal-buttons">
      ${targetPlayers
        .map((playerIndex) => {
          return `<button data-player="${playerIndex}">${players[playerIndex]}</button>`;
        })
        .join("")}
    </div>
  `;

  stealArea.querySelectorAll("[data-player]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetPlayer = Number(button.dataset.player);

      stealArea.classList.add("hidden");
      stealArea.innerHTML = "";

      onSelect(targetPlayer);
    });
  });
}
function updateDevCardsDisplay() {
  devCardsDiv.innerHTML = players
    .map((player, index) => {
      const cards = playerDevelopmentCards[index];

      const cardText =
        cards.length === 0
          ? "なし"
          : cards
              .map((card) => {
                const status = card.canUse ? "使用可" : "次ターンから";
                return `${card.type}(${status})`;
              })
              .join(" / ");

      return `<div>${player}：${cardText}</div>`;
    })
    .join("");
}
function useYearOfPlentyCard() {
  const player = getCurrentPlayer();
  const cards = playerDevelopmentCards[player];

  const cardIndex = cards.findIndex(
    (card) => card.type === "year_of_plenty" && card.canUse,
  );

  if (cardIndex === -1) {
    alert("使える資源2枚カードがありません。");
    return;
  }

  const resource1 = prompt(
    "1枚目の資源を入力してください（木・麦・羊・土・鉄）",
  );
  const resource2 = prompt(
    "2枚目の資源を入力してください（木・麦・羊・土・鉄）",
  );

  const validResources = ["木", "麦", "羊", "土", "鉄"];

  if (
    !validResources.includes(resource1) ||
    !validResources.includes(resource2)
  ) {
    alert("資源名が正しくありません。");
    return;
  }

  playerResources[player][resource1]++;
  playerResources[player][resource2]++;

  cards.splice(cardIndex, 1);

  updateResourcesDisplay();
  updateDevCardsDisplay();

  alert(`${players[player]}が${resource1}と${resource2}を獲得しました。`);
}
function useMonopolyCard() {
  const player = getCurrentPlayer();
  const cards = playerDevelopmentCards[player];

  const cardIndex = cards.findIndex(
    (card) => card.type === "monopoly" && card.canUse,
  );

  if (cardIndex === -1) {
    alert("使える独占カードがありません。");
    return;
  }

  const resource = prompt(
    "独占する資源を入力してください（木・麦・羊・土・鉄）",
  );
  const validResources = ["木", "麦", "羊", "土", "鉄"];

  if (!validResources.includes(resource)) {
    alert("資源名が正しくありません。");
    return;
  }

  let totalStolen = 0;

  players.forEach((_, index) => {
    if (index === player) return;

    const amount = playerResources[index][resource];

    playerResources[index][resource] = 0;
    playerResources[player][resource] += amount;

    totalStolen += amount;
  });

  cards.splice(cardIndex, 1);

  updateResourcesDisplay();
  updateDevCardsDisplay();

  alert(`${players[player]}が${resource}を${totalStolen}枚独占しました。`);
}
function useRoadBuildingCard() {
  const player = getCurrentPlayer();
  const cards = playerDevelopmentCards[player];

  const cardIndex = cards.findIndex(
    (card) => card.type === "road_building" && card.canUse,
  );

  if (cardIndex === -1) {
    alert("使える街道建設カードがありません。");
    return;
  }

  cards.splice(cardIndex, 1);

  freeRoadBuildCount = 2;

  updateDevCardsDisplay();

  alert("街道建設カードを使いました。道を2本無料で置けます。");
}
function tradeWithBank() {
  const player = getCurrentPlayer();

  if (phase !== "main") {
    alert("メインフェーズでのみ交換できます。");
    return;
  }

  if (!hasRolledDice) {
    alert("サイコロを振ってから交換してください。");
    return;
  }

  const giveResource = prompt(
    "出す資源を入力してください（木・麦・羊・土・鉄）",
  );
  const receiveResource = prompt(
    "もらう資源を入力してください（木・麦・羊・土・鉄）",
  );

  const validResources = ["木", "麦", "羊", "土", "鉄"];

  if (
    !validResources.includes(giveResource) ||
    !validResources.includes(receiveResource)
  ) {
    alert("資源名が正しくありません。");
    return;
  }

  const rate = getTradeRate(player, giveResource);

  if (playerResources[player][giveResource] < rate) {
    alert(`${giveResource}が${rate}枚足りません。`);
    return;
  }

  playerResources[player][giveResource] -= rate;
  playerResources[player][receiveResource]++;

  updateResourcesDisplay();

  alert(`${giveResource}${rate}枚を${receiveResource}1枚に交換しました。`);
}
function openTradeMenu() {
  if (phase !== "main") {
    alert("メインフェーズでのみ交換できます。");
    return;
  }

  if (!hasRolledDice) {
    alert("サイコロを振ってから交換してください。");
    return;
  }
  tradeState = {
    give: { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
    receive: { 木: 0, 麦: 0, 羊: 0, 土: 0, 鉄: 0 },
  };

  tradeArea.classList.remove("hidden");
  renderTradeControls();
}
function getMissingResourceCount(resources, cost) {
  let missingTotal = 0;

  Object.keys(cost).forEach((resource) => {
    const missing = Math.max(0, cost[resource] - resources[resource]);

    missingTotal += missing;
  });

  return missingTotal;
}
function getResourceNeedScore(player, resource) {
  const resources = playerResources[player];

  let score = 0;

  // ===== 開拓地 =====

  const settlementVertex = getCpuBuildableSettlementVertex(player);

  const canExpand = settlementVertex !== null;

  if (canExpand) {
    const missingTotal = getMissingResourceCount(resources, COSTS.settlement);

    const missing = Math.max(
      0,
      COSTS.settlement[resource] - resources[resource],
    );

    if (missingTotal === 1 && missing > 0) {
      score += 8;
    } else if (missingTotal === 2 && missing > 0) {
      score += 4;
    } else if (missing > 0) {
      score += 2;
    }
  }

  // ===== 都市化 =====

  const hasUpgradeableSettlement = settlements.some((settlement) => {
    return settlement.player === player && settlement.type === "settlement";
  });

  if (hasUpgradeableSettlement) {
    const missingTotal = getMissingResourceCount(resources, COSTS.city);

    const missing = Math.max(0, COSTS.city[resource] - resources[resource]);

    if (missingTotal === 1 && missing > 0) {
      score += 8;
    } else if (missingTotal === 2 && missing > 0) {
      score += 4;
    } else if (missing > 0) {
      score += 2;
    }
  }

  // ===== 道 =====

  const roadEdge = getCpuBuildableRoadEdge(player);

  const canBuildRoad = roadEdge !== null;

  if (canBuildRoad) {
    const missingTotal = getMissingResourceCount(resources, COSTS.road);

    const missing = Math.max(0, COSTS.road[resource] - resources[resource]);

    if (missingTotal === 1 && missing > 0) {
      score += 5;
    } else if (missingTotal === 2 && missing > 0) {
      score += 3;
    }
  }

  // ===== 発展カード =====

  const missingTotal = getMissingResourceCount(resources, DEV_COST);

  const missing = Math.max(0, DEV_COST[resource] - resources[resource]);

  if (missingTotal === 1 && missing > 0) {
    score += 4;
  } else if (missingTotal === 2 && missing > 0) {
    score += 2;
  }

  // ===== 枯渇・余剰 =====

  if (resources[resource] === 0) {
    score += 2;
  }

  if (resources[resource] >= 4) {
    score -= 4;
  } else if (resources[resource] >= 3) {
    score -= 2;
  }

  return score;
}
function cpuAcceptTrade(targetPlayer, receiveItems, giveItems) {
  const afterResources = getResourcesAfterTrade(
    targetPlayer,
    giveItems,
    receiveItems,
  );

  const hasNegativeResource = RESOURCES.some((resource) => {
    return afterResources[resource] < 0;
  });

  if (hasNegativeResource) {
    return false;
  }

  const tradePlans = getCpuTradePlans(targetPlayer);

  const makesProgress = tradePlans.some((plan) => {
    return isTradeProgressForGoal(
      targetPlayer,
      plan.goal,
      giveItems,
      receiveItems,
    );
  });

  if (!makesProgress) {
    return false;
  }

  const receiveValue = getTradeValueForPlayer(targetPlayer, receiveItems);
  const giveValue = getTradeValueForPlayer(targetPlayer, giveItems);

  return receiveValue + 2 >= giveValue;
}
function tradeWithPlayer() {
  const player = getCurrentPlayer();

  if (phase !== "main") {
    alert("メインフェーズでのみ交換できます。");
    return;
  }

  if (!hasRolledDice) {
    alert("サイコロを振ってから交渉してください。");
    return;
  }

  const giveResource = prompt("自分が渡す資源（木・麦・羊・土・鉄）");
  const giveCount = Number(prompt("自分が渡す枚数"));

  const receiveResource = prompt("ほしい資源（木・麦・羊・土・鉄）");
  const receiveCount = Number(prompt("ほしい枚数"));

  const validResources = ["木", "麦", "羊", "土", "鉄"];

  if (
    !validResources.includes(giveResource) ||
    !validResources.includes(receiveResource) ||
    Number.isNaN(giveCount) ||
    Number.isNaN(receiveCount) ||
    giveCount <= 0 ||
    receiveCount <= 0
  ) {
    alert("交換条件が正しくありません。");
    return;
  }

  if (playerResources[player][giveResource] < giveCount) {
    alert(`${players[player]}の${giveResource}が足りません。`);
    return;
  }

  const playerGiveItems = createTradeItems(giveResource, giveCount);
  const targetGiveItems = createTradeItems(receiveResource, receiveCount);

  const acceptedPlayers = players
    .map((_, index) => index)
    .filter((targetPlayer) => {
      if (targetPlayer === player) return false;

      if (playerResources[targetPlayer][receiveResource] < receiveCount) {
        return false;
      }

      if (isCpuPlayer(targetPlayer)) {
        return cpuAcceptTrade(targetPlayer, playerGiveItems, targetGiveItems);
      }

      return false;
    });

  if (acceptedPlayers.length === 0) {
    alert("この条件を承諾するプレイヤーはいませんでした。");
    return;
  }

  const message = acceptedPlayers
    .map((playerIndex, index) => {
      return `${index + 1}: ${players[playerIndex]}`;
    })
    .join("\n");

  const input = prompt(
    `この条件を承諾したプレイヤーです。\n${message}\n交換する相手を番号で選んでください。`,
  );

  const selectedIndex = Number(input) - 1;

  if (
    Number.isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= acceptedPlayers.length
  ) {
    alert("正しく選択されなかったので、交換しません。");
    return;
  }

  const targetPlayer = acceptedPlayers[selectedIndex];

  playerResources[player][giveResource] -= giveCount;
  playerResources[targetPlayer][giveResource] += giveCount;

  playerResources[targetPlayer][receiveResource] -= receiveCount;
  playerResources[player][receiveResource] += receiveCount;

  updateResourcesDisplay();

  alert(
    `${players[targetPlayer]}と交換成立！\n` +
      `${players[player]}：${giveResource}${giveCount}枚を渡す\n` +
      `${players[targetPlayer]}：${receiveResource}${receiveCount}枚を渡す`,
  );
}
function getPortEdgeKey(port) {
  const tilePos = getTilePositionByIndex(port.tileIndex);
  if (!tilePos) return null;

  const tileVertices = getHexVertices(tilePos.x, tilePos.y);
  const keyA = getVertexKey(tileVertices[port.side]);
  const keyB = getVertexKey(tileVertices[(port.side + 1) % 6]);

  return [keyA, keyB].sort().join("_");
}
function hasPort(playerIndex, portType, giveResource) {
  return ports.some((port) => {
    if (portType === "specific" && port.type !== giveResource) return false;
    if (portType === "any" && port.type !== "any") return false;

    const edgeKey = getPortEdgeKey(port);
    if (!edgeKey) return false;

    const [keyA, keyB] = edgeKey.split("_");

    return settlements.some((s) => {
      return s.player === playerIndex && (s.key === keyA || s.key === keyB);
    });
  });
}
function getTradeRate(playerIndex, giveResource) {
  if (hasPort(playerIndex, "specific", giveResource)) {
    return 2;
  }

  if (hasPort(playerIndex, "any", giveResource)) {
    return 3;
  }

  return 4;
}
function renderPorts() {
  ports.forEach((port) => {
    const edgeKey = getPortEdgeKey(port);
    if (!edgeKey) return;

    const [keyA, keyB] = edgeKey.split("_");
    const v1 = vertices.find((v) => v.key === keyA);
    const v2 = vertices.find((v) => v.key === keyB);

    if (!v1 || !v2) return;

    const centerX = board.clientWidth / 2;
    const centerY = board.clientHeight / 2;

    const midX = (v1.x + v2.x) / 2;
    const midY = (v1.y + v2.y) / 2;

    const dx = midX - centerX;
    const dy = midY - centerY;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    const offset = 42;

    const portX = midX + (dx / length) * offset;
    const portY = midY + (dy / length) * offset;

    const arrowStartX = portX - (dx / length) * 14;
    const arrowStartY = portY - (dy / length) * 14;
    const arrowEndX = midX;
    const arrowEndY = midY;

    const arrowDx = arrowEndX - arrowStartX;
    const arrowDy = arrowEndY - arrowStartY;
    const arrowLength = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);
    const arrowAngle = Math.atan2(arrowDy, arrowDx) * (180 / Math.PI);

    const arrowEl = document.createElement("div");
    arrowEl.className = "port-arrow";
    arrowEl.style.left = `${arrowStartX}px`;
    arrowEl.style.top = `${arrowStartY}px`;
    arrowEl.style.width = `${arrowLength}px`;
    arrowEl.style.transform = `rotate(${arrowAngle}deg)`;
    board.appendChild(arrowEl);

    const portEl = document.createElement("div");
    portEl.className = "port";
    portEl.textContent = port.type === "any" ? "3:1" : `${port.type}2:1`;
    portEl.style.left = `${portX}px`;
    portEl.style.top = `${portY}px`;
    board.appendChild(portEl);
  });
}
function renderTradeControls() {
  giveControls.innerHTML = "";
  receiveControls.innerHTML = "";

  RESOURCES.forEach((resource) => {
    const giveRow = document.createElement("div");
    giveRow.className = "resource-row";

    giveRow.innerHTML = `
      <span>${resource}</span>
      <button type="button" data-type="give" data-resource="${resource}" data-action="minus">−</button>
      <span>${tradeState.give[resource]}枚</span>
      <button type="button" data-type="give" data-resource="${resource}" data-action="plus">＋</button>
    `;

    giveControls.appendChild(giveRow);

    const receiveRow = document.createElement("div");
    receiveRow.className = "resource-row";

    receiveRow.innerHTML = `
      <span>${resource}</span>
      <button type="button" data-type="receive" data-resource="${resource}" data-action="minus">−</button>
      <span>${tradeState.receive[resource]}枚</span>
      <button type="button" data-type="receive" data-resource="${resource}" data-action="plus">＋</button>
    `;

    receiveControls.appendChild(receiveRow);
  });

  tradeArea.querySelectorAll("button[data-resource]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.type;
      const resource = button.dataset.resource;
      const action = button.dataset.action;

      if (action === "plus") {
        tradeState[type][resource]++;
      } else {
        tradeState[type][resource] = Math.max(
          0,
          tradeState[type][resource] - 1,
        );
      }

      renderTradeControls();
    });
  });
}
function getCpu(player) {
  const totalResources = Object.values(playerResources[player]).reduce(
    (sum, amount) => {
      return sum + amount;
    },
    0,
  );

  if (totalResources >= 8) {
    if (hasResources(player, COSTS.city)) {
      return "city";
    }

    if (hasResources(player, COSTS.settlement)) {
      const vertex = getCpuBuildableSettlementVertex(player);

      if (vertex) {
        return "settlement";
      }
    }

    if (hasResources(player, COSTS.road)) {
      const road = getCpuBuildableRoadEdge(player);

      if (road) {
        return "road";
      }
    }

    return "trade";
  }
  const score = calculateScore(player);

  if (score >= 8) {
    if (hasResources(player, COSTS.city)) {
      return "city";
    }

    if (hasResources(player, COSTS.settlement)) {
      const vertex = getCpuBuildableSettlementVertex(player);

      if (vertex) {
        return "settlement";
      }
    }

    if (hasResources(player, DEV_COST)) {
      return "development";
    }
  }
  if (hasResources(player, COSTS.city)) {
    return "city";
  }

  if (hasResources(player, COSTS.settlement)) {
    const vertex = getCpuBuildableSettlementVertex(player);

    if (vertex) {
      return "settlement";
    }
  }

  if (hasResources(player, COSTS.road)) {
    const road = getCpuBuildableRoadEdge(player);

    if (road) {
      return "road";
    }
  }

  if (hasResources(player, DEV_COST)) {
    return "development";
  }
  if (totalResources >= 6) {
    return "trade";
  }

  return "wait";
}
function getCpuResourceGoal(player) {
  if (hasResources(player, COSTS.city)) {
    return "city";
  }

  if (hasResources(player, COSTS.settlement)) {
    const vertex = getCpuBuildableSettlementVertex(player);

    if (vertex) {
      return "settlement";
    }
  }

  if (hasResources(player, COSTS.road)) {
    const road = getCpuBuildableRoadEdge(player);

    if (road) {
      return "road";
    }
  }

  if (hasResources(player, DEV_COST)) {
    return "development";
  }

  return "settlement";
}
function randomizeBoardTilesAndNumbers() {
  const resourceTiles = [
    { type: "forest", label: "木" },
    { type: "forest", label: "木" },
    { type: "forest", label: "木" },
    { type: "forest", label: "木" },

    { type: "field", label: "麦" },
    { type: "field", label: "麦" },
    { type: "field", label: "麦" },
    { type: "field", label: "麦" },

    { type: "pasture", label: "羊" },
    { type: "pasture", label: "羊" },
    { type: "pasture", label: "羊" },
    { type: "pasture", label: "羊" },

    { type: "hill", label: "土" },
    { type: "hill", label: "土" },
    { type: "hill", label: "土" },

    { type: "mountain", label: "鉄" },
    { type: "mountain", label: "鉄" },
    { type: "mountain", label: "鉄" },

    { type: "desert", label: "砂" },
  ];

  shuffle(resourceTiles);

  tiles.length = 0;

  resourceTiles.forEach((tile) => {
    tiles.push({
      type: tile.type,
      label: tile.label,
      number: null,
    });
  });

  assignRandomNumbersWithoutAdjacentSixEight();
}
function assignRandomNumbersWithoutAdjacentSixEight() {
  const numberTokens = [
    5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11,
  ];

  let success = false;

  while (!success) {
    shuffle(numberTokens);

    let numberIndex = 0;

    tiles.forEach((tile) => {
      if (tile.type === "desert") {
        tile.number = null;
        return;
      }

      tile.number = numberTokens[numberIndex];
      numberIndex++;
    });

    success = !hasAdjacentSixEight();
  }
}
function hasAdjacentSixEight() {
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].number !== 6 && tiles[i].number !== 8) {
      continue;
    }

    const neighborIndexes = getNeighborTileIndexes(i);

    const hasBadNeighbor = neighborIndexes.some((neighborIndex) => {
      return (
        tiles[neighborIndex].number === 6 || tiles[neighborIndex].number === 8
      );
    });

    if (hasBadNeighbor) {
      return true;
    }
  }

  return false;
}
function getNeighborTileIndexes(tileIndex) {
  const neighbors = [];

  const targetPos = getTilePositionByIndex(tileIndex);
  if (!targetPos) return neighbors;

  tiles.forEach((_, index) => {
    if (index === tileIndex) return;

    const pos = getTilePositionByIndex(index);
    if (!pos) return;

    const dx = Math.abs(pos.x - targetPos.x);
    const dy = Math.abs(pos.y - targetPos.y);

    if (dx <= HEX_WIDTH + 1 && dy <= VERTICAL_SPACING + 1) {
      neighbors.push(index);
    }
  });

  return neighbors;
}
function getVertexDegree(vertexKey) {
  return vertexNeighbors[vertexKey]?.length || 0;
}

function hasOtherPlayerRoadToVertex(vertexKey, player) {
  return roads.some((roadData) => {
    if (roadData.player === player) return false;

    const road = edges.find((edge) => edge.key === roadData.key);
    if (!road) return false;

    return road.from === vertexKey || road.to === vertexKey;
  });
}

function canExtendRoadAfterPlacing(edge, player) {
  const forwardKey = getRoadForwardVertex(edge, player);
  if (!forwardKey) return false;

  if (blocksRoadContinuation(forwardKey, player)) return false;

  return edges.some((nextEdge) => {
    if (nextEdge.key === edge.key) return false;

    const alreadyRoad = roads.some((road) => road.key === nextEdge.key);
    if (alreadyRoad) return false;

    return nextEdge.from === forwardKey || nextEdge.to === forwardKey;
  });
}

function shouldCpuAvoidContestedVertex(edge, player) {
  const forwardKey = getRoadForwardVertex(edge, player);
  if (!forwardKey) return false;

  const degree = getVertexDegree(forwardKey);
  const otherRoadExists = hasOtherPlayerRoadToVertex(forwardKey, player);

  if (!otherRoadExists) return false;

  const canSettleNow = canPlaceSettlementAtVertex(forwardKey);
  const canExtendNext = canExtendRoadAfterPlacing(edge, player);

  // 辺3本の頂点：他人が向かっているなら基本避ける
  // ただし、開拓地を立てられる or さらに先へ伸ばせるならOK
  if (degree >= 3) {
    return !canSettleNow && !canExtendNext;
  }

  // 辺2本の頂点：他人が向かっているならかなり厳しく避ける
  // ただし、開拓地を立てられるならOK
  if (degree === 2) {
    return !canSettleNow;
  }

  return false;
}
function shouldCpuTrade(player) {
  const tradePlans = getCpuTradePlans(player);

  if (tradePlans.length === 0) {
    return false;
  }

  for (const tradePlan of tradePlans) {
    const receiveItems = getBestCpuReceiveItems(
      player,
      tradePlan.wantResources,
    );

    if (!receiveItems) continue;

    const giveCandidates = getCpuGiveCandidates(player, tradePlan.goal);

    for (const giveItems of giveCandidates) {
      if (
        isTradeProgressForGoal(player, tradePlan.goal, giveItems, receiveItems)
      ) {
        return true;
      }
    }
  }

  return false;
}
function getCpuStrategy(player) {
  const resources = playerResources[player];

  if (
    hasResources(player, COSTS.city) &&
    getCpuBuildableCitySettlement(player)
  ) {
    return "city";
  }

  if (
    hasResources(player, COSTS.settlement) &&
    getCpuBuildableSettlementVertex(player)
  ) {
    return "settlement";
  }

  if (hasResources(player, COSTS.road) && getCpuBuildableRoadEdge(player)) {
    return "road";
  }

  if (hasResources(player, DEV_COST)) {
    return "development";
  }

  const totalResources =
    resources.木 + resources.麦 + resources.羊 + resources.土 + resources.鉄;

  if (shouldCpuTrade(player)) {
    return "trade";
  }

  return "none";
}
function tradeWithBankByState() {
  const player = getCurrentPlayer();

  const giveEntries = RESOURCES.filter((resource) => {
    return tradeState.give[resource] > 0;
  });

  const receiveEntries = RESOURCES.filter((resource) => {
    return tradeState.receive[resource] > 0;
  });

  if (giveEntries.length !== 1 || receiveEntries.length !== 1) {
    alert("銀行・港交換では、出す資源1種類ともらう資源1種類を選んでください。");
    return;
  }

  const giveResource = giveEntries[0];
  const receiveResource = receiveEntries[0];
  const rate = getTradeRate(player, giveResource);

  if (
    tradeState.give[giveResource] !== rate ||
    tradeState.receive[receiveResource] !== 1
  ) {
    alert(
      `${giveResource}は${rate}枚で、${receiveResource}1枚と交換できます。`,
    );
    return;
  }

  if (playerResources[player][giveResource] < rate) {
    alert(`${giveResource}が${rate}枚足りません。`);
    return;
  }

  playerResources[player][giveResource] -= rate;
  playerResources[player][receiveResource]++;

  tradeArea.classList.add("hidden");
  updateResourcesDisplay();

  alert(`${giveResource}${rate}枚を${receiveResource}1枚に交換しました。`);
}
function tradeWithPlayerByState() {
  const player = getCurrentPlayer();

  const giveEntries = RESOURCES.filter((resource) => {
    return tradeState.give[resource] > 0;
  });

  const receiveEntries = RESOURCES.filter((resource) => {
    return tradeState.receive[resource] > 0;
  });

  if (giveEntries.length === 0 || receiveEntries.length === 0) {
    alert("渡す資源と欲しい資源を選んでください。");
    return;
  }

  for (const resource of RESOURCES) {
    if (playerResources[player][resource] < tradeState.give[resource]) {
      alert(`${resource}が足りません。`);
      return;
    }
  }

  const acceptedPlayers = players
    .map((_, index) => index)
    .filter((targetPlayer) => {
      if (targetPlayer === player) return false;

      const canPay = RESOURCES.every((resource) => {
        return (
          playerResources[targetPlayer][resource] >=
          tradeState.receive[resource]
        );
      });

      if (!canPay) return false;

      if (isCpuPlayer(targetPlayer)) {
        return cpuAcceptTrade(
          targetPlayer,
          tradeState.give,
          tradeState.receive,
        );
      }

      return false;
    });

  if (acceptedPlayers.length === 0) {
    alert("この条件を承諾するプレイヤーはいませんでした。");
    return;
  }

  const message = acceptedPlayers
    .map((playerIndex, index) => {
      return `${index + 1}: ${players[playerIndex]}`;
    })
    .join("\n");

  const input = prompt(
    `この条件を承諾したプレイヤーです。\n${message}\n交換する相手を番号で選んでください。`,
  );

  const selectedIndex = Number(input) - 1;

  if (
    Number.isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= acceptedPlayers.length
  ) {
    alert("正しく選択されなかったので、交換しません。");
    return;
  }

  const targetPlayer = acceptedPlayers[selectedIndex];

  RESOURCES.forEach((resource) => {
    playerResources[player][resource] -= tradeState.give[resource];
    playerResources[targetPlayer][resource] += tradeState.give[resource];

    playerResources[targetPlayer][resource] -= tradeState.receive[resource];
    playerResources[player][resource] += tradeState.receive[resource];
  });

  tradeArea.classList.add("hidden");
  updateResourcesDisplay();

  alert(`${players[targetPlayer]}と交換成立しました。`);
}
function getTradePlayerResourcesText(playerA, playerB) {
  return [playerA, playerB]
    .map((playerIndex) => {
      const r = playerResources[playerIndex];

      return `${players[playerIndex]}：木${r.木} / 麦${r.麦} / 羊${r.羊} / 土${r.土} / 鉄${r.鉄}`;
    })
    .join("\n");
}
function updateHumanPlayerInfo() {
  const element = document.getElementById("human-player-info");

  element.textContent = `あなたの色：${players[humanPlayerIndex]}`;
}
function showResultScreen(winnerIndex) {
  document.getElementById("board").classList.add("hidden");
  document.getElementById("result-screen").classList.remove("hidden");

  document.getElementById("winner-text").textContent =
    `勝者：${players[winnerIndex]}`;

  document.getElementById("final-scores").innerHTML = players
    .map((player, index) => {
      return `<div>${player}：${calculateScore(index)}点</div>`;
    })
    .join("");
}
function checkWinner() {
  const winnerIndex = players.findIndex((_, index) => {
    return calculateScore(index) >= 10;
  });

  if (winnerIndex !== -1) {
    showResultScreen(winnerIndex);
  }
}
function saveGame() {
  const data = {
    playerResources,
    playerDevelopmentCards,
    settlements,
    roads,
    currentPlayerIndex,
    robberTileIndex,
    isRobberMoving,
    hasRolledDice,
    phase,
    setupStep,
    setupIndex,
    lastSetupSettlementKey,
    largestArmyOwner,
    longestRoadOwner,
    knightCount,
    humanPlayerIndex,
    tiles,
  };

  localStorage.setItem("catanSaveData", JSON.stringify(data));
  console.log("ゲームを保存しました");
}
function loadGame() {
  const text = localStorage.getItem("catanSaveData");
  if (!text) return false;

  const data = JSON.parse(text);

  playerResources.splice(0, playerResources.length, ...data.playerResources);
  playerDevelopmentCards.splice(
    0,
    playerDevelopmentCards.length,
    ...data.playerDevelopmentCards,
  );

  settlements = data.settlements;
  roads = data.roads;
  currentPlayerIndex = data.currentPlayerIndex;
  robberTileIndex = data.robberTileIndex;
  isRobberMoving = data.isRobberMoving;
  hasRolledDice = data.hasRolledDice;
  phase = data.phase;
  setupStep = data.setupStep;
  setupIndex = data.setupIndex;
  lastSetupSettlementKey = data.lastSetupSettlementKey;
  largestArmyOwner = data.largestArmyOwner;
  longestRoadOwner = data.longestRoadOwner;
  humanPlayerIndex = data.humanPlayerIndex;

  knightCount.splice(0, knightCount.length, ...data.knightCount);
  tiles.splice(0, tiles.length, ...data.tiles);

  renderBoard();
  updateResourcesDisplay();
  updateScoresDisplay();
  updateCurrentPlayerText();
  updateDevCardsDisplay();

  console.log("ゲームを復元しました");
  return true;
}
function showCpuTradeOffer(
  cpuPlayer,
  targetPlayer,
  cpuGiveItems,
  cpuReceiveItems,
) {
  const area = document.getElementById("cpu-trade-offer");

  pendingCpuTrade = {
    cpuPlayer,
    targetPlayer,
    cpuGiveItems,
    cpuReceiveItems,
  };

  const cpuGiveText = tradeItemsToText(cpuGiveItems);
  const cpuReceiveText = tradeItemsToText(cpuReceiveItems);
  const myResources = playerResources[targetPlayer];

  area.classList.remove("hidden");

  area.innerHTML = `
    <h3>${players[cpuPlayer]}CPUから交渉です</h3>

    <p>${players[cpuPlayer]}CPU：${cpuGiveText} 渡す</p>
    <p>${players[targetPlayer]}：${cpuReceiveText} 渡す</p>

    <p>
      あなたの資源：
      木${myResources.木} /
      麦${myResources.麦} /
      羊${myResources.羊} /
      土${myResources.土} /
      鉄${myResources.鉄}
    </p>

    <button id="accept-cpu-trade">承諾する</button>
    <button id="reject-cpu-trade">断る</button>
  `;

  document
    .getElementById("accept-cpu-trade")
    .addEventListener("click", acceptCpuTrade);
  document
    .getElementById("reject-cpu-trade")
    .addEventListener("click", rejectCpuTrade);
}
function tradeItemsToText(items) {
  const text = RESOURCES.filter((resource) => items[resource] > 0)
    .map((resource) => `${resource}${items[resource]}枚`)
    .join("・");

  return text || "なし";
}
function acceptCpuTrade() {
  if (!pendingCpuTrade) return;

  const { cpuPlayer, targetPlayer, cpuGiveItems, cpuReceiveItems } =
    pendingCpuTrade;

  RESOURCES.forEach((resource) => {
    playerResources[cpuPlayer][resource] -= cpuGiveItems[resource];
    playerResources[targetPlayer][resource] += cpuGiveItems[resource];

    playerResources[targetPlayer][resource] -= cpuReceiveItems[resource];
    playerResources[cpuPlayer][resource] += cpuReceiveItems[resource];
  });

  pendingCpuTrade = null;

  document.getElementById("cpu-trade-offer").classList.add("hidden");
  document.getElementById("cpu-trade-offer").innerHTML = "";

  updateResourcesDisplay();

  logCpuAction("CPUとの交渉が成立しました");
  finishCurrentCpuTurn();
}
function rejectCpuTrade() {
  pendingCpuTrade = null;

  document.getElementById("cpu-trade-offer").classList.add("hidden");
  document.getElementById("cpu-trade-offer").innerHTML = "";

  logCpuAction("CPUとの交渉を断りました");

  finishCurrentCpuTurn();
}
function clearPendingCpuTrade() {
  pendingCpuTrade = null;

  const area = document.getElementById("cpu-trade-offer");

  if (!area) return;

  area.classList.add("hidden");
  area.innerHTML = "";
}
function getReachableVerticesAfterRoad(edge, player, maxDistance) {
  const results = [];
  const visited = new Set();

  const startKey = getRoadStartVertex(edge, player);
  const forwardKey = getRoadForwardVertex(edge, player);

  if (!startKey || !forwardKey) {
    return results;
  }

  const queue = [
    {
      vertexKey: forwardKey,
      distance: 1,
    },
  ];

  visited.add(startKey);
  visited.add(forwardKey);

  while (queue.length > 0) {
    const current = queue.shift();

    results.push({
      vertexKey: current.vertexKey,
      distance: current.distance,
    });

    if (current.distance >= maxDistance) continue;

    const nextEdges = edges.filter((nextEdge) => {
      const isConnectedToCurrent =
        nextEdge.from === current.vertexKey ||
        nextEdge.to === current.vertexKey;

      if (!isConnectedToCurrent) return false;

      const existingRoad = roads.find((road) => {
        return road.key === nextEdge.key;
      });

      // 他人の道は通れない
      if (existingRoad && existingRoad.player !== player) {
        return false;
      }

      return true;
    });

    nextEdges.forEach((nextEdge) => {
      const nextVertexKey =
        nextEdge.from === current.vertexKey ? nextEdge.to : nextEdge.from;

      if (blocksRoadContinuation(nextVertexKey, player)) {
        results.push({
          vertexKey: nextVertexKey,
          distance: current.distance + 1,
        });

        return;
      }

      if (visited.has(nextVertexKey)) return;

      visited.add(nextVertexKey);

      queue.push({
        vertexKey: nextVertexKey,
        distance: current.distance + 1,
      });
    });
  }

  return results;
}
function getDistanceFromPlayerSettlement(vertexKey, player) {
  const queue = [];
  const visited = new Set();

  settlements.forEach((settlement) => {
    if (settlement.player !== player) return;

    queue.push({
      vertexKey: settlement.key,
      distance: 0,
    });

    visited.add(settlement.key);
  });

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.vertexKey === vertexKey) {
      return current.distance;
    }

    const connectedEdges = edges.filter((edge) => {
      const existingRoad = roads.find((road) => road.key === edge.key);

      if (!existingRoad || existingRoad.player !== player) return false;

      return edge.from === current.vertexKey || edge.to === current.vertexKey;
    });

    connectedEdges.forEach((edge) => {
      const nextVertexKey =
        edge.from === current.vertexKey ? edge.to : edge.from;

      if (visited.has(nextVertexKey)) return;

      visited.add(nextVertexKey);

      queue.push({
        vertexKey: nextVertexKey,
        distance: current.distance + 1,
      });
    });
  }

  return Infinity;
}
function getRoadStartVertex(edge, player) {
  const fromConnected = isVertexConnectedToPlayerNetwork(edge.from, player);
  const toConnected = isVertexConnectedToPlayerNetwork(edge.to, player);

  if (fromConnected && !toConnected) return edge.from;
  if (toConnected && !fromConnected) return edge.to;

  if (fromConnected && toConnected) {
    const fromDistance = getDistanceFromPlayerSettlement(edge.from, player);
    const toDistance = getDistanceFromPlayerSettlement(edge.to, player);

    if (fromDistance < toDistance) return edge.from;
    if (toDistance < fromDistance) return edge.to;
  }

  return null;
}
function getRoadForwardVertex(edge, player) {
  const startKey = getRoadStartVertex(edge, player);

  if (!startKey) return null;

  return edge.from === startKey ? edge.to : edge.from;
}

function isVertexConnectedToPlayerNetwork(vertexKey, player) {
  const hasOwnSettlement = settlements.some((settlement) => {
    return settlement.player === player && settlement.key === vertexKey;
  });

  if (hasOwnSettlement) return true;

  const hasOwnRoad = roads.some((roadData) => {
    if (roadData.player !== player) return false;

    const road = edges.find((edge) => edge.key === roadData.key);
    if (!road) return false;

    return road.from === vertexKey || road.to === vertexKey;
  });

  return hasOwnRoad;
}
rollButton.addEventListener("click", rollDice);

nextTurnButton.addEventListener("click", () => {
  // サイコロ未実行
  if (!hasRolledDice) {
    alert("サイコロを振ってからターン終了してください。");
    return;
  }

  // 盗賊移動中
  if (isRobberMoving) {
    alert("盗賊の移動を完了してください。");
    return;
  }

  // 捨て処理中
  if (discardState !== null) {
    alert("資源の破棄を完了してください。");
    return;
  }

  // ターン進行
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

  hasRolledDice = false;

  // ★追加：次ターン開始時にカードを使えるようにする
  playerDevelopmentCards[currentPlayerIndex].forEach((card) => {
    card.canUse = true;
  });

  updateCurrentPlayerText();
  updateDevCardsDisplay();
  runCpuTurnIfNeeded();
});
document.getElementById("use-knight").addEventListener("click", useKnightCard);

document
  .getElementById("buy-dev-card")
  .addEventListener("click", buyDevelopmentCard);
document
  .getElementById("use-year-of-plenty")
  .addEventListener("click", useYearOfPlentyCard);
document
  .getElementById("use-monopoly")
  .addEventListener("click", useMonopolyCard);
document
  .getElementById("use-road-building")
  .addEventListener("click", useRoadBuildingCard);

document.getElementById("open-trade").addEventListener("click", openTradeMenu);
document.getElementById("trade-confirm").addEventListener("click", () => {
  const choice = prompt(
    "交換方法を選んでください\n\n" + "1: 銀行・港交換\n" + "2: プレイヤー交渉",
  );

  if (choice === "1") {
    tradeWithBankByState();
    return;
  }

  if (choice === "2") {
    tradeWithPlayerByState();
    return;
  }

  alert("正しく選択してください。");
});
document.getElementById("trade-cancel").addEventListener("click", () => {
  tradeArea.classList.add("hidden");
});
saveGameButton.addEventListener("click", () => {
  saveGame();
  alert("ゲームを保存しました！");
});
clearSaveButton.addEventListener("click", () => {
  localStorage.removeItem("catanSaveData");
  alert("保存データを削除しました。次の再読み込みで新規ゲームになります。");
});
if (!loadGame()) {
  shuffle(developmentDeck);
  randomizeBoardTilesAndNumbers();

  updateCurrentPlayerText();
  updateResourcesDisplay();
  updateScoresDisplay();
  updateDevCardsDisplay();
  updateHumanPlayerInfo();
  renderBoard();
}
runCpuTurnIfNeeded();
