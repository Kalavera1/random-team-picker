"use strict";

const TEAM_COLORS = [
  "#f0d27a", "#4a7a8c", "#ff9a8a", "#3a6e48",
  "#1f5066", "#c9974a", "#c97a7a", "#7a9c7a",
];

// Deliberately silly / absurd suggestions for people who can't think of a
// team name. Shown as muted chips — click one to add it as a real team name.
const TEAM_NAME_SUGGESTIONS = [
  "Hosen-Matrosen", "Wurstwasser-Gäng", "Anfahren am Berg", "Kartoffelsalat-Kommando",
  "Bratwurst-Bataillon", "Klobürsten-Kavallerie", "Flachwitz-Fraktion", "Rückwärts-Einparker",
  "Sockenschubser United", "Bierzelt-Ballett", "Currywurst-Cartel", "Frittenfett-Fraktion",
  "Zwiebelringe der Rache", "Turbo-Schnarchnasen", "Handbremsen-Helden", "Lattenzaun-Legenden",
  "Schwiegermutter-Schreck", "Pantoffel-Piraten", "Sparbrötchen-Squad", "Fernbedienungs-Fanatiker",
  "Discofieber-Diplomaten", "Grillzangen-Gang", "Halbwissen-Helden", "Chaos im Kopf",
  "Rentner-Turbo-Crew", "Karnevalsprinzen a.D.", "Bierdeckel-Bande", "Trollhausen United",
  "Der Elch ist los", "Kegelbahn-Krieger", "Schnarch-Allianz", "Radler-Rambos",
  "Grumpelgreise", "Sofa-Elite", "Gurkentruppe Delta", "Rasenmäher-Rebellen",
  "Käsefüße Chaoten", "Wackelpudding-Wikinger", "Nackenbart-Nomaden", "Almauftrieb Ultras",
];

const VISIBLE_SUGGESTIONS = 6;
const SHUFFLE_JITTER_MS = 450;
const DEAL_STAGGER_MS = 130;
const FLIP_TRANSITION_MS = 500;

const MODE_LABELS = { even: "Gleichverteilt", fill: "Füllen" };

// ---------- DOM refs ----------

const playerNameInput = document.getElementById("playerNameInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const teamSizeInput = document.getElementById("teamSizeInput");
const seedInput = document.getElementById("seedInput");
const teamNameInput = document.getElementById("teamNameInput");
const addTeamNameBtn = document.getElementById("addTeamNameBtn");
const teamNameChipsEl = document.getElementById("teamNameChips");
const drawBtn = document.getElementById("drawBtn");
const errorMsg = document.getElementById("errorMsg");
const poolEl = document.getElementById("pool");
const poolCountEl = document.getElementById("poolCount");
const poolEmptyHint = document.getElementById("poolEmptyHint");
const teamsSection = document.getElementById("teamsSection");
const teamsEl = document.getElementById("teams");
const drawMetaEl = document.getElementById("drawMeta");
const drawMetaTextEl = document.getElementById("drawMetaText");
const downloadCertBtn = document.getElementById("downloadCertBtn");

// ---------- state ----------

let players = []; // { id, name, teamIndex } — teamIndex -1 means "in the pool"
let pendingTeamNames = [];
let suggestionPool = shuffle(TEAM_NAME_SUGGESTIONS.slice());
let currentSuggestions = drawSuggestions(VISIBLE_SUGGESTIONS);
let distributionMode = "even";
let lastDrawInfo = null; // { seed, mode, timestamp, teamNames }

const tileEls = new Map(); // player id -> tile DOM element
let dragState = null;

// ---------- helpers ----------

function genId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Simple 32-bit PRNG (mulberry32) so a given seed always reshuffles the same way.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a: turns an arbitrary seed string into a 32-bit int for mulberry32.
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function shuffle(array, rng = Math.random) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function drawSuggestions(n) {
  if (suggestionPool.length < n) {
    suggestionPool = shuffle(TEAM_NAME_SUGGESTIONS.slice());
  }
  return suggestionPool.splice(0, n);
}

function teamCountFor(playerCount, teamSize) {
  return Math.max(1, Math.ceil(playerCount / teamSize));
}

// "Füllen": fills teams up to `teamSize` one after another; the last team
// gets whatever is left over (e.g. 4 players / size 3 → [3, 1]).
function assignTeamsFill(shuffledIds, teamSize) {
  const chunks = [];
  for (let i = 0; i < shuffledIds.length; i += teamSize) {
    chunks.push(shuffledIds.slice(i, i + teamSize));
  }
  return chunks;
}

// "Gleichverteilt": deals ids round-robin across the same number of teams,
// so sizes differ by at most 1 (e.g. 4 players / size 3 → [2, 2]).
function assignTeamsEven(shuffledIds, teamSize) {
  const count = teamCountFor(shuffledIds.length, teamSize);
  const chunks = Array.from({ length: count }, () => []);
  shuffledIds.forEach((id, i) => chunks[i % count].push(id));
  return chunks;
}

function computeTeamNames(customNames, teamCount) {
  const names = [];
  for (let i = 0; i < teamCount; i++) {
    const custom = customNames[i];
    names.push(custom && custom.length > 0 ? custom : `Team ${i + 1}`);
  }
  return names;
}

// Round-robin deal order: team 1 gets a tile, then team 2, ... then back to
// team 1 — like dealing cards around a table.
function buildDealOrder(teamChunks) {
  const order = [];
  const maxSize = Math.max(...teamChunks.map((c) => c.length));
  for (let round = 0; round < maxSize; round++) {
    teamChunks.forEach((chunk, teamIndex) => {
      if (round < chunk.length) order.push({ id: chunk[round], teamIndex });
    });
  }
  return order;
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.hidden = true;
}

function validateInputs(playerList, teamSize) {
  if (playerList.length < 2) {
    return "Bitte mindestens 2 Spieler hinzufügen.";
  }
  if (!Number.isInteger(teamSize) || teamSize < 1) {
    return "Spieler pro Team muss eine ganze Zahl ≥ 1 sein.";
  }
  return null;
}

function formatTimestamp(date) {
  return date.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

function fileStamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function updatePoolStatus() {
  const unassigned = players.filter((p) => p.teamIndex === -1).length;
  poolCountEl.textContent = String(unassigned);

  if (players.length === 0) {
    poolEmptyHint.textContent = "Noch keine Spieler – oben Namen hinzufügen.";
    poolEmptyHint.hidden = false;
  } else if (unassigned === 0) {
    poolEmptyHint.textContent = "Alle Spieler sind einem Team zugeordnet.";
    poolEmptyHint.hidden = false;
  } else {
    poolEmptyHint.hidden = true;
  }
}

// ---------- tile creation & inline editing ----------

function createTileElement(player) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.dataset.id = player.id;

  const nameSpan = document.createElement("span");
  nameSpan.className = "tile-name";
  nameSpan.textContent = player.name;

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "tile-btn tile-edit";
  editBtn.title = "Namen bearbeiten";
  editBtn.textContent = "✏️";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "tile-btn tile-remove";
  removeBtn.title = "Entfernen";
  removeBtn.textContent = "✕";

  tile.append(nameSpan, editBtn, removeBtn);

  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startEditTile(player.id);
  });

  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removePlayer(player.id);
  });

  tile.addEventListener("pointerdown", (e) => onTilePointerDown(e, player.id));

  return tile;
}

function startEditTile(id) {
  const tile = tileEls.get(id);
  const player = players.find((p) => p.id === id);
  if (!tile || !player || tile.classList.contains("editing")) return;

  tile.classList.add("editing");
  const nameSpan = tile.querySelector(".tile-name");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "tile-name-input";
  input.maxLength = 30;
  input.value = player.name;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  function commit() {
    if (committed) return;
    committed = true;
    const newName = input.value.trim() || player.name;
    player.name = newName;
    const span = document.createElement("span");
    span.className = "tile-name";
    span.textContent = newName;
    input.replaceWith(span);
    tile.classList.remove("editing");
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      input.value = player.name;
      commit();
    }
  });
  input.addEventListener("blur", commit);
}

function removePlayer(id) {
  players = players.filter((p) => p.id !== id);
  const tile = tileEls.get(id);
  tileEls.delete(id);
  if (tile) {
    tile.classList.add("removing");
    tile.addEventListener("transitionend", () => tile.remove(), { once: true });
    setTimeout(() => tile.remove(), 300);
  }
  updatePoolStatus();
}

// ---------- drag & drop (pointer-based, mouse + touch) ----------

function onTilePointerDown(e, id) {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
  if (e.target.closest("button")) return;

  const tile = tileEls.get(id);
  if (!tile || tile.classList.contains("editing")) return;

  const rect = tile.getBoundingClientRect();
  dragState = {
    id,
    tile,
    originParent: tile.parentElement,
    originNext: tile.nextSibling,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
  };

  tile.setPointerCapture(e.pointerId);
  tile.classList.add("dragging");
  tile.style.width = `${rect.width}px`;
  document.body.appendChild(tile);
  positionDragTile(e.clientX, e.clientY);

  tile.addEventListener("pointermove", onTilePointerMove);
  tile.addEventListener("pointerup", onTilePointerUp);
  tile.addEventListener("pointercancel", onTilePointerUp);
}

function positionDragTile(clientX, clientY) {
  if (!dragState) return;
  dragState.tile.style.left = `${clientX - dragState.offsetX}px`;
  dragState.tile.style.top = `${clientY - dragState.offsetY}px`;
}

function findDropZone(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  return el ? el.closest(".dropzone") : null;
}

function onTilePointerMove(e) {
  if (!dragState) return;
  positionDragTile(e.clientX, e.clientY);
  const zone = findDropZone(e.clientX, e.clientY);
  document.querySelectorAll(".dropzone.drop-hover").forEach((z) => {
    if (z !== zone) z.classList.remove("drop-hover");
  });
  if (zone) zone.classList.add("drop-hover");
}

function onTilePointerUp(e) {
  if (!dragState) return;
  const { tile, id, originParent, originNext } = dragState;

  tile.releasePointerCapture(e.pointerId);
  tile.removeEventListener("pointermove", onTilePointerMove);
  tile.removeEventListener("pointerup", onTilePointerUp);
  tile.removeEventListener("pointercancel", onTilePointerUp);

  const zone = findDropZone(e.clientX, e.clientY);
  document.querySelectorAll(".dropzone.drop-hover").forEach((z) => z.classList.remove("drop-hover"));

  tile.classList.remove("dragging");
  tile.style.position = "";
  tile.style.left = "";
  tile.style.top = "";
  tile.style.width = "";

  if (zone) {
    zone.appendChild(tile);
    const player = players.find((p) => p.id === id);
    if (player) player.teamIndex = parseInt(zone.dataset.teamIndex, 10);
    tile.classList.add("landing");
    setTimeout(() => tile.classList.remove("landing"), 500);
  } else if (originNext) {
    originParent.insertBefore(tile, originNext);
  } else {
    originParent.appendChild(tile);
  }

  dragState = null;
  updatePoolStatus();
}

// ---------- team name chips + suggestions ----------

function renderTeamNameChips() {
  teamNameChipsEl.innerHTML = "";
  pendingTeamNames.forEach((name, index) => {
    const chip = document.createElement("span");
    chip.className = "chip";

    const label = document.createElement("span");
    label.textContent = name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chip-remove";
    remove.textContent = "✕";
    remove.addEventListener("click", () => {
      pendingTeamNames.splice(index, 1);
      renderTeamNameChips();
    });

    chip.append(label, remove);
    teamNameChipsEl.appendChild(chip);
  });
}

function renderSuggestions() {
  const suggestionsEl = document.getElementById("teamNameSuggestions");
  suggestionsEl.innerHTML = "";
  currentSuggestions.forEach((name, idx) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip suggestion-chip";
    chip.textContent = name;
    chip.title = "Klicken zum Übernehmen";
    chip.addEventListener("click", () => {
      pendingTeamNames.push(name);
      renderTeamNameChips();
      currentSuggestions[idx] = drawSuggestions(1)[0];
      renderSuggestions();
    });
    suggestionsEl.appendChild(chip);
  });
}

function addPlayer() {
  const name = playerNameInput.value.trim();
  if (!name) return;
  const player = { id: genId(), name, teamIndex: -1 };
  players.push(player);
  const tile = createTileElement(player);
  tileEls.set(player.id, tile);
  poolEl.appendChild(tile);
  playerNameInput.value = "";
  playerNameInput.focus();
  updatePoolStatus();
}

function addTeamName() {
  const name = teamNameInput.value.trim();
  if (!name) return;
  pendingTeamNames.push(name);
  teamNameInput.value = "";
  renderTeamNameChips();
}

// ---------- the draw itself ----------

function buildTeamColumns(names) {
  teamsEl.innerHTML = "";
  const lists = [];
  names.forEach((name, index) => {
    const column = document.createElement("div");
    column.className = "team-column";
    column.style.setProperty("--team-color", TEAM_COLORS[index % TEAM_COLORS.length]);

    const heading = document.createElement("h3");
    heading.textContent = name;

    const list = document.createElement("div");
    list.className = "tile-list dropzone";
    list.dataset.teamIndex = String(index);

    column.append(heading, list);
    teamsEl.appendChild(column);
    lists.push(list);
  });
  return lists;
}

function flipTileTo(tile, targetList, firstRect) {
  targetList.appendChild(tile);
  const lastRect = tile.getBoundingClientRect();
  const dx = firstRect.left - lastRect.left;
  const dy = firstRect.top - lastRect.top;

  tile.style.transition = "none";
  tile.style.transform = `translate(${dx}px, ${dy}px)`;
  void tile.offsetWidth; // force reflow so the transform above actually applies first
  tile.style.transition = "";
  tile.classList.add("landing");

  requestAnimationFrame(() => {
    tile.style.transform = "";
  });

  tile.addEventListener(
    "transitionend",
    function handler() {
      tile.classList.remove("landing");
      tile.removeEventListener("transitionend", handler);
    },
    { once: true }
  );
}

function startDraw() {
  clearError();

  const teamSize = parseInt(teamSizeInput.value, 10);
  const validationError = validateInputs(players, teamSize);
  if (validationError) {
    showError(validationError);
    return;
  }

  drawBtn.disabled = true;

  // Snapshot current positions of every tile before we touch the DOM (FLIP).
  const firstRects = new Map();
  players.forEach((p) => {
    const el = tileEls.get(p.id);
    if (el) firstRects.set(p.id, el.getBoundingClientRect());
  });

  const rawSeed = seedInput.value.trim();
  const usedSeed = rawSeed || `auto-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const rng = mulberry32(hashSeed(usedSeed));

  const shuffledIds = shuffle(players.map((p) => p.id), rng);
  const assignFn = distributionMode === "fill" ? assignTeamsFill : assignTeamsEven;
  const teamChunks = assignFn(shuffledIds, teamSize);
  const names = computeTeamNames(pendingTeamNames, teamChunks.length);
  const lists = buildTeamColumns(names);
  teamsSection.hidden = false;

  const timestamp = new Date();
  lastDrawInfo = { seed: usedSeed, mode: distributionMode, timestamp, teamNames: names };
  drawMetaTextEl.textContent = "";
  drawMetaTextEl.append(
    `${formatTimestamp(timestamp)} · Modus: ${MODE_LABELS[distributionMode]} · Seed: `,
    Object.assign(document.createElement("code"), { textContent: usedSeed })
  );
  drawMetaEl.hidden = false;

  teamChunks.forEach((ids, teamIndex) => {
    ids.forEach((id) => {
      const player = players.find((p) => p.id === id);
      if (player) player.teamIndex = teamIndex;
    });
  });

  // Brief in-place jitter on every tile to sell the "mixing" moment.
  players.forEach((p) => tileEls.get(p.id)?.classList.add("shuffle-jitter"));

  setTimeout(() => {
    players.forEach((p) => tileEls.get(p.id)?.classList.remove("shuffle-jitter"));

    const dealOrder = buildDealOrder(teamChunks);
    dealOrder.forEach(({ id, teamIndex }, i) => {
      setTimeout(() => {
        const tile = tileEls.get(id);
        const firstRect = firstRects.get(id);
        if (!tile || !firstRect) return;
        flipTileTo(tile, lists[teamIndex], firstRect);
      }, i * DEAL_STAGGER_MS);
    });

    const totalTime = dealOrder.length * DEAL_STAGGER_MS + FLIP_TRANSITION_MS;
    setTimeout(() => {
      drawBtn.disabled = false;
      updatePoolStatus();
    }, totalTime);
  }, SHUFFLE_JITTER_MS);
}

// ---------- certificate download ----------

function getCurrentTeamsData() {
  if (!lastDrawInfo) return null;
  const teams = lastDrawInfo.teamNames.map((name) => ({ name, members: [] }));
  players.forEach((p) => {
    if (p.teamIndex >= 0 && p.teamIndex < teams.length) {
      teams[p.teamIndex].members.push(p.name);
    }
  });
  return teams;
}

function downloadCertificate() {
  const teams = getCurrentTeamsData();
  if (!teams || !lastDrawInfo) return;

  const WIDTH = 800;
  const PADDING = 56;
  const TITLE_H = 42;
  const SUBTITLE_H = 46;
  const DIVIDER_GAP = 24;
  const TEAM_HEADER_H = 34;
  const LINE_H = 26;
  const TEAM_GAP = 22;
  const FOOTER_H = 46;

  let bodyHeight = 0;
  teams.forEach((t) => {
    bodyHeight += TEAM_HEADER_H + Math.max(t.members.length, 1) * LINE_H + TEAM_GAP;
  });

  const height = Math.round(PADDING * 2 + TITLE_H + SUBTITLE_H + DIVIDER_GAP + bodyHeight + FOOTER_H);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#152128";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#f0d27a";
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.strokeStyle = "#4a7a8c";
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);

  let y = PADDING;

  ctx.fillStyle = "#f0d27a";
  ctx.font = "700 30px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🎲 Team-Auslosung", canvas.width / 2, y);
  y += TITLE_H;

  ctx.fillStyle = "#9fb3bd";
  ctx.font = "400 14px 'Segoe UI', sans-serif";
  const modeLabel = MODE_LABELS[lastDrawInfo.mode] || lastDrawInfo.mode;
  ctx.fillText(
    `${formatTimestamp(lastDrawInfo.timestamp)}  ·  Modus: ${modeLabel}  ·  Seed: ${lastDrawInfo.seed}`,
    canvas.width / 2,
    y
  );
  y += SUBTITLE_H;

  ctx.strokeStyle = "#34474f";
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(canvas.width - PADDING, y);
  ctx.stroke();
  y += DIVIDER_GAP;

  ctx.textAlign = "left";
  teams.forEach((team, index) => {
    const color = TEAM_COLORS[index % TEAM_COLORS.length];
    ctx.fillStyle = color;
    ctx.fillRect(PADDING, y - 18, 5, TEAM_HEADER_H);
    ctx.font = "700 18px 'Segoe UI', sans-serif";
    ctx.fillText(team.name, PADDING + 16, y);
    y += TEAM_HEADER_H;

    ctx.font = "400 15px 'Segoe UI', sans-serif";
    if (team.members.length === 0) {
      ctx.fillStyle = "#9fb3bd";
      ctx.fillText("– niemand zugeordnet –", PADDING + 16, y);
      y += LINE_H;
    } else {
      team.members.forEach((name) => {
        ctx.fillStyle = "#eef3f5";
        ctx.fillText(`•  ${name}`, PADDING + 16, y);
        y += LINE_H;
      });
    }
    y += TEAM_GAP;
  });

  ctx.fillStyle = "#9fb3bd";
  ctx.font = "400 12px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Erstellt mit Random Team Picker", canvas.width / 2, canvas.height - 26);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-auslosung-${fileStamp(lastDrawInfo.timestamp)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}

// ---------- wiring ----------

addPlayerBtn.addEventListener("click", addPlayer);
playerNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addPlayer();
  }
});

addTeamNameBtn.addEventListener("click", addTeamName);
teamNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTeamName();
  }
});

drawBtn.addEventListener("click", startDraw);
downloadCertBtn.addEventListener("click", downloadCertificate);

document.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".segmented-btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-checked", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-checked", "true");
    distributionMode = btn.dataset.mode;
  });
});

document.getElementById("refreshSuggestionsBtn").addEventListener("click", () => {
  currentSuggestions = drawSuggestions(VISIBLE_SUGGESTIONS);
  renderSuggestions();
});

renderSuggestions();
updatePoolStatus();
