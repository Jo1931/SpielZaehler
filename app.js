const STORAGE_KEY = "spielzaehler-state-v1";

const app = document.querySelector("#app");
const title = document.querySelector("#page-title");
const backButton = document.querySelector("#back-button");
const installButton = document.querySelector("#install-button");
const connectionStatus = document.querySelector("#connection-status");

let state = loadState();
let view = { name: "home", gameId: null };
let editingRoundId = null;
let installPrompt = null;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && Array.isArray(parsed.games) ? parsed : { games: [] };
  } catch {
    return { games: [] };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneTemplate(id) {
  return document.querySelector(id).content.cloneNode(true);
}

function navigate(name, gameId = null) {
  view = { name, gameId };
  editingRoundId = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  app.replaceChildren();
  backButton.classList.toggle("hidden", view.name === "home");

  if (view.name === "new") renderNewGame();
  else if (view.name === "game") renderGame(view.gameId);
  else renderHome();
}

function renderHome() {
  title.textContent = "SpielZähler";
  const fragment = cloneTemplate("#home-template");
  const list = fragment.querySelector("#game-list");
  fragment.querySelector("#game-count").textContent = state.games.length === 1 ? "1 Partie" : `${state.games.length} Partien`;

  if (!state.games.length) {
    list.innerHTML = `<div class="empty-state"><strong>Noch keine Partie</strong><p>Starte eure erste Runde – alles bleibt direkt auf diesem Gerät gespeichert.</p></div>`;
  } else {
    [...state.games]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach((game) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "game-card";
        button.dataset.gameId = game.id;
        const roundLabel = game.rounds.length === 1 ? "1 Runde" : `${game.rounds.length} Runden`;
        button.innerHTML = `<span><strong>${escapeHtml(game.name)}</strong><span>${game.players.length} Mitspieler · ${roundLabel}</span></span><span class="chevron">›</span>`;
        list.append(button);
      });
  }
  app.append(fragment);
}

function renderNewGame() {
  title.textContent = "Neue Partie";
  const fragment = cloneTemplate("#new-game-template");
  const fields = fragment.querySelector("#player-fields");
  addPlayerField(fields, "");
  addPlayerField(fields, "");
  app.append(fragment);
  document.querySelector("#game-name").focus();
}

function addPlayerField(container, value) {
  const row = document.createElement("div");
  row.className = "player-row";
  row.innerHTML = `<input class="text-input player-name" aria-label="Name des Mitspielers" placeholder="Name" maxlength="24" value="${escapeHtml(value)}" required autocomplete="off"><button class="remove-player" type="button" aria-label="Person entfernen">×</button>`;
  container.append(row);
}

function getTotals(game) {
  return Object.fromEntries(game.players.map((player) => [player.id, game.rounds.reduce((sum, round) => sum + (Number(round.scores[player.id]) || 0), 0)]));
}

function renderGame(gameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return navigate("home");

  app.replaceChildren();
  title.textContent = game.name;
  const fragment = cloneTemplate("#game-template");
  const totals = getTotals(game);
  const highest = Math.max(...Object.values(totals));
  const scoreboard = fragment.querySelector("#scoreboard");

  game.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = `score-card${game.rounds.length && totals[player.id] === highest ? " leader" : ""}`;
    card.innerHTML = `<span>${escapeHtml(player.name)}</span><strong>${formatScore(totals[player.id])}</strong>`;
    scoreboard.append(card);
  });

  const scoreFields = fragment.querySelector("#score-fields");
  game.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `<label for="score-${player.id}">${escapeHtml(player.name)}</label><input class="score-input" id="score-${player.id}" name="${player.id}" type="number" inputmode="numeric" step="1" placeholder="0" aria-label="Punkte für ${escapeHtml(player.name)}">`;
    scoreFields.append(row);
  });

  const roundList = fragment.querySelector("#round-list");
  fragment.querySelector("#round-count").textContent = game.rounds.length === 1 ? "1 Runde" : `${game.rounds.length} Runden`;
  if (!game.rounds.length) {
    roundList.innerHTML = `<div class="empty-state"><strong>Bereit für Runde 1</strong><p>Trage oben die Punkte ein. Auch Minuswerte sind möglich.</p></div>`;
  } else {
    [...game.rounds].reverse().forEach((round) => {
      const roundNumber = game.rounds.indexOf(round) + 1;
      const card = document.createElement("article");
      card.className = "round-card";
      card.innerHTML = `<div class="round-summary"><strong>Runde ${roundNumber}</strong><div class="round-actions"><button type="button" data-edit-round="${round.id}">Ändern</button><button type="button" class="delete-round" data-delete-round="${round.id}" aria-label="Runde ${roundNumber} löschen">Löschen</button></div></div><div class="round-scores">${game.players.map((player) => `<div class="round-score"><span>${escapeHtml(player.name)}</span><strong>${formatScore(round.scores[player.id] || 0)}</strong></div>`).join("")}</div>`;
      roundList.append(card);
    });
  }

  app.append(fragment);
}

function startEditingRound(roundId) {
  const game = state.games.find((item) => item.id === view.gameId);
  const round = game?.rounds.find((item) => item.id === roundId);
  if (!round) return;
  editingRoundId = roundId;
  document.querySelector("#round-kicker").textContent = "Korrektur";
  document.querySelector("#round-form-title").textContent = `Runde ${game.rounds.indexOf(round) + 1} ändern`;
  document.querySelector("#save-round").textContent = "Änderungen speichern";
  document.querySelector("#cancel-edit").classList.remove("hidden");
  game.players.forEach((player) => {
    document.querySelector(`#score-${CSS.escape(player.id)}`).value = round.scores[player.id] ?? 0;
  });
  document.querySelector("#round-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveRound(form) {
  const game = state.games.find((item) => item.id === view.gameId);
  if (!game) return;
  const data = new FormData(form);
  const scores = Object.fromEntries(game.players.map((player) => [player.id, Number(data.get(player.id)) || 0]));
  if (editingRoundId) {
    const round = game.rounds.find((item) => item.id === editingRoundId);
    if (round) round.scores = scores;
  } else {
    game.rounds.push({ id: makeId(), scores, createdAt: Date.now() });
  }
  game.updatedAt = Date.now();
  persist();
  editingRoundId = null;
  renderGame(game.id);
}

function deleteRound(roundId) {
  const game = state.games.find((item) => item.id === view.gameId);
  if (!game || !confirm("Diese Runde wirklich löschen?")) return;
  game.rounds = game.rounds.filter((round) => round.id !== roundId);
  game.updatedAt = Date.now();
  persist();
  renderGame(game.id);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function formatScore(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

app.addEventListener("click", (event) => {
  const newGame = event.target.closest('[data-action="new-game"]');
  const gameCard = event.target.closest("[data-game-id]");
  const editRound = event.target.closest("[data-edit-round]");
  const removeRound = event.target.closest("[data-delete-round]");
  const deleteGame = event.target.closest('[data-action="delete-game"]');

  if (newGame) navigate("new");
  else if (gameCard) navigate("game", gameCard.dataset.gameId);
  else if (editRound) startEditingRound(editRound.dataset.editRound);
  else if (removeRound) deleteRound(removeRound.dataset.deleteRound);
  else if (deleteGame && confirm("Diese Partie mit allen Runden wirklich löschen?")) {
    state.games = state.games.filter((game) => game.id !== view.gameId);
    persist();
    navigate("home");
  }
});

app.addEventListener("click", (event) => {
  if (event.target.id === "add-player") addPlayerField(document.querySelector("#player-fields"), "");
  if (event.target.closest(".remove-player")) {
    const fields = document.querySelector("#player-fields");
    if (fields.children.length <= 2) return alert("Für eine Partie braucht ihr mindestens zwei Personen.");
    event.target.closest(".player-row").remove();
  }
  if (event.target.id === "cancel-edit") renderGame(view.gameId);
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "new-game-form") {
    const names = [...document.querySelectorAll(".player-name")].map((input) => input.value.trim()).filter(Boolean);
    if (names.length < 2) return alert("Bitte gib mindestens zwei Namen ein.");
    const normalized = names.map((name) => name.toLocaleLowerCase());
    if (new Set(normalized).size !== names.length) return alert("Bitte verwende unterschiedliche Namen.");
    const game = {
      id: makeId(),
      name: document.querySelector("#game-name").value.trim(),
      players: names.map((name) => ({ id: makeId(), name })),
      rounds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.games.push(game);
    persist();
    navigate("game", game.id);
  } else if (event.target.id === "round-form") saveRound(event.target);
});

backButton.addEventListener("click", () => navigate("home"));

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.classList.add("hidden");
});

function updateConnectionStatus() {
  connectionStatus.classList.toggle("hidden", navigator.onLine);
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
