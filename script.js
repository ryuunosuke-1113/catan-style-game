const board = document.getElementById("board");
const rollButton = document.getElementById("roll-button");
const diceResult = document.getElementById("dice-result");
const currentPlayerText = document.getElementById("current-player");
const nextTurnButton = document.getElementById("next-turn-button");
const resourcesDiv = document.getElementById("resources");
const HEX_WIDTH = 70;
const HEX_HEIGHT = 80;

const HORIZONTAL_SPACING = HEX_WIDTH;
const VERTICAL_SPACING = HEX_HEIGHT * 0.75;
const scoresDiv = document.getElementById("scores");
const discardArea = document.getElementById("discard-area");

let discardState = null;

const players = ["青", "赤", "黄", "緑"];
const knightCount = [0, 0, 0, 0];
let currentPlayerIndex = 0;
let robberTileIndex = 9; // 最初は砂漠に置く
let isRobberMoving = false;
let hasRolledDice = false;

const tiles = [
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

        if (!hasResources(player, COSTS.road)) {
          alert("資源不足");
          return;
        }

        consumeResources(player, COSTS.road);
      }

      roads.push({
        key: edge.key,
        player: player,
      });

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
      // ★追加：サイコロ前は建設禁止
      if (phase === "main" && !hasRolledDice) {
        alert("サイコロを振ってから建設してください。");
        return;
      }
      const player = getCurrentPlayer();

      const existingSettlement = settlements.find((s) => s.key === vertex.key);

      // すでに開拓地がある場合 → 都市化
      if (existingSettlement) {
        if (phase === "setup") {
          alert("初期配置中は都市にできません。");
          return;
        }

        if (phase === "setup" && setupStep !== "settlement") {
          alert("今は道を置く番です。");
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

      // 開拓地を新しく建てる処理
      if (isAdjacentToSettlement(vertex)) {
        alert("隣り合う頂点には開拓地を置けません。");
        return;
      }

      if (phase !== "setup") {
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
        if (!isRobberMoving) return;

        robberTileIndex = currentTileIndex;

        isRobberMoving = false;
        const targetPlayers = getPlayersAdjacentToTile(currentTileIndex);

        if (targetPlayers.length === 0) {
          alert("奪える相手がいません。");
        } else {
          const targetPlayer = choosePlayerToSteal(targetPlayers);

          if (targetPlayer !== null) {
            stealRandomResource(targetPlayer, getCurrentPlayer());
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
    handleRobber();
    return;
  }

  highlightTiles(total);
  giveResourcesByDice(total);
}
function updateCurrentPlayerText() {
  const player = players[getCurrentPlayer()];
  currentPlayerText.textContent = `現在のプレイヤー: ${player}（${phase} / ${setupStep}）`;
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
  return settlements
    .filter((s) => s.player === playerIndex)
    .reduce((total, settlement) => {
      if (settlement.type === "city") {
        return total + 2;
      }

      return total + 1;
    }, 0);
}

function updateScoresDisplay() {
  scoresDiv.innerHTML = players
    .map((player, index) => {
      return `${player}: ${calculateScore(index)}点`;
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
    return;
  }

  const { playerIndex, discardCount } = queue.shift();

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

  alert("騎士カードを使用しました");

  // 盗賊発動（7と同じ処理）
  handleRobber();
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
});
document.getElementById("use-knight").addEventListener("click", useKnightCard);

shuffle(developmentDeck);
updateCurrentPlayerText();
updateResourcesDisplay();
updateScoresDisplay();
renderBoard();
