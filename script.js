"use strict";

const TEAM_COLORS = [
  "#7c5cff", "#22d3ee", "#ff6b9d", "#ffb84d",
  "#4ade80", "#ff8a5c", "#5ce1e6", "#c084fc",
];

const CARD_WIDTH = 90;
const CARD_HEIGHT = 128;
const DEAL_INTERVAL_MS = 220;
const SHUFFLE_DURATION_MS = 900;
const FLIGHT_DURATION_MS = 650;
const FLIP_DELAY_MS = 250;

const setupEl = document.getElementById("setup");
const stageEl = document.getElementById("stage");
const namesInput = document.getElementById("namesInput");
const teamSizeInput = document.getElementById("teamSizeInput");
const teamNamesInput = document.getElementById("teamNamesInput");
const errorMsg = document.getElementById("errorMsg");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const deckEl = document.getElementById("deck");
const teamsEl = document.getElementById("teams");

function parseLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.hidden = true;
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Splits the shuffled names into chunks of `teamSize`. The last chunk
// simply receives whatever is left over.
function assignTeams(shuffledNames, teamSize) {
  const teams = [];
  for (let i = 0; i < shuffledNames.length; i += teamSize) {
    teams.push(shuffledNames.slice(i, i + teamSize));
  }
  return teams;
}

function computeTeamNames(customNames, teamCount) {
  const names = [];
  for (let i = 0; i < teamCount; i++) {
    const custom = customNames[i];
    names.push(custom && custom.length > 0 ? custom : `Team ${i + 1}`);
  }
  return names;
}

// Round-robin deal order: team 1 gets a card, then team 2, ... then back
// to team 1, like dealing a real deck of cards around a table.
function buildDealOrder(teams) {
  const order = [];
  const maxSize = Math.max(...teams.map((t) => t.length));
  for (let round = 0; round < maxSize; round++) {
    for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
      if (round < teams[teamIndex].length) {
        order.push({ name: teams[teamIndex][round], teamIndex });
      }
    }
  }
  return order;
}

function renderTeamColumns(teamNames) {
  teamsEl.innerHTML = "";
  const listEls = [];
  teamNames.forEach((name, index) => {
    const column = document.createElement("div");
    column.className = "team-column";
    column.style.setProperty("--team-color", TEAM_COLORS[index % TEAM_COLORS.length]);

    const heading = document.createElement("h3");
    heading.textContent = name;

    const list = document.createElement("ul");
    list.className = "team-list";

    column.appendChild(heading);
    column.appendChild(list);
    teamsEl.appendChild(column);
    listEls.push(list);
  });
  return listEls;
}

function renderDeckVisual(playerCount) {
  deckEl.innerHTML = "";
  const visualCount = Math.min(playerCount, 6);
  for (let i = 0; i < visualCount; i++) {
    const back = document.createElement("div");
    back.className = "deck-card card-face card-front";
    back.textContent = "🂠";
    const jitterX = (Math.random() * 6 - 3).toFixed(1);
    const jitterY = (Math.random() * 6 - 3).toFixed(1);
    const rotate = (Math.random() * 8 - 4).toFixed(1);
    back.style.transform = `translate(${jitterX}px, ${jitterY}px) rotate(${rotate}deg)`;
    deckEl.appendChild(back);
  }
}

function spawnFlyingCard(name, targetList) {
  return new Promise((resolve) => {
    const stageRect = stageEl.getBoundingClientRect();
    const deckRect = deckEl.getBoundingClientRect();
    const targetRect = targetList.getBoundingClientRect();

    const startLeft = deckRect.left - stageRect.left + deckRect.width / 2 - CARD_WIDTH / 2;
    const startTop = deckRect.top - stageRect.top + deckRect.height / 2 - CARD_HEIGHT / 2;
    const targetLeft = targetRect.left - stageRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
    const targetTop = targetRect.top - stageRect.top;

    const card = document.createElement("div");
    card.className = "card";
    card.style.left = `${startLeft}px`;
    card.style.top = `${startTop}px`;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-front">🂠</div>
        <div class="card-face card-back">${escapeHtml(name)}</div>
      </div>
    `;

    stageEl.appendChild(card);

    // Force layout so the browser registers the start position before we
    // animate to the target — otherwise the transition gets skipped.
    // eslint-disable-next-line no-unused-expressions
    card.getBoundingClientRect();

    requestAnimationFrame(() => {
      card.style.left = `${targetLeft}px`;
      card.style.top = `${targetTop}px`;
    });

    setTimeout(() => {
      card.classList.add("flipped");
    }, FLIP_DELAY_MS);

    setTimeout(() => {
      card.remove();
      const item = document.createElement("li");
      item.textContent = name;
      targetList.appendChild(item);
      resolve();
    }, FLIGHT_DURATION_MS);
  });
}

function dealCards(dealOrder, teamListEls) {
  return new Promise((resolve) => {
    let index = 0;
    function dealNext() {
      if (index >= dealOrder.length) {
        resolve();
        return;
      }
      const { name, teamIndex } = dealOrder[index];
      spawnFlyingCard(name, teamListEls[teamIndex]);
      index++;
      setTimeout(dealNext, DEAL_INTERVAL_MS);
    }
    dealNext();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function validateInputs(names, teamSize) {
  if (names.length < 2) {
    return "Bitte mindestens 2 Spielernamen eingeben (einen pro Zeile).";
  }
  if (!Number.isInteger(teamSize) || teamSize < 1) {
    return "Spieler pro Team muss eine ganze Zahl ≥ 1 sein.";
  }
  return null;
}

function startDraw() {
  clearError();

  const names = parseLines(namesInput.value);
  const teamSize = parseInt(teamSizeInput.value, 10);
  const customTeamNames = parseLines(teamNamesInput.value);

  const validationError = validateInputs(names, teamSize);
  if (validationError) {
    showError(validationError);
    return;
  }

  const teams = assignTeams(shuffle(names), teamSize);
  const teamNames = computeTeamNames(customTeamNames, teams.length);
  const teamListEls = renderTeamColumns(teamNames);
  renderDeckVisual(names.length);

  setupEl.hidden = true;
  stageEl.hidden = false;
  resetBtn.hidden = true;

  deckEl.classList.add("shuffling");

  setTimeout(() => {
    deckEl.classList.remove("shuffling");
    const dealOrder = buildDealOrder(teams);
    dealCards(dealOrder, teamListEls).then(() => {
      resetBtn.hidden = false;
    });
  }, SHUFFLE_DURATION_MS);
}

function resetToSetup() {
  stageEl.hidden = true;
  teamsEl.innerHTML = "";
  deckEl.innerHTML = "";
  setupEl.hidden = false;
}

startBtn.addEventListener("click", startDraw);
resetBtn.addEventListener("click", resetToSetup);
