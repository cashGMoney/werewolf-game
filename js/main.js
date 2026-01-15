// js/main.js
window.addEventListener("load", () => {
  const savedRoomId = localStorage.getItem("roomId");
  const savedPlayerId = localStorage.getItem("playerId");
  const savedPlayerName = localStorage.getItem("playerName");
  const savedIsHost = localStorage.getItem("isHost") === "1";

  if (savedRoomId && savedPlayerId) {
    currentRoomId = savedRoomId;
    currentPlayerId = savedPlayerId;
    currentPlayerName = savedPlayerName;
    isHost = savedIsHost;

    subscribeToRoom(savedRoomId);
    roomCodeDisplay.textContent = savedRoomId;
    playerNameDisplay.textContent = savedPlayerName;

    showScreen("screen-waiting-room");
  }
});

let currentRoomId = null;
let currentPlayerId = null;
let currentPlayerName = null;
let isHost = false;
let currentRoleId = null;

const screens = document.querySelectorAll(".screen");
function showScreen(id) {
  screens.forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// DOM elements
const hostNameInput = document.getElementById("host-name");
const btnCreateRoom = document.getElementById("btn-create-room");
const joinRoomCodeInput = document.getElementById("join-room-code");
const joinNameInput = document.getElementById("join-name");
const btnJoinRoom = document.getElementById("btn-join-room");
const roomCodeDisplay = document.getElementById("room-code-display");
const playerNameDisplay = document.getElementById("player-name-display");
const playerListEl = document.getElementById("player-list");
const btnStartGame = document.getElementById("btn-start-game");
const roleNameEl = document.getElementById("role-name");
const roleDescriptionEl = document.getElementById("role-description");
const btnContinueFromRole = document.getElementById("btn-continue-from-role");
const nightInstructionsEl = document.getElementById("night-instructions");
const nightActionContainer = document.getElementById("night-action-container");
const voteContainer = document.getElementById("vote-container");
const resultsTextEl = document.getElementById("results-text");
const btnNextPhase = document.getElementById("btn-next-phase");

// Utility: generate simple room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Utility: generate player id
function generatePlayerId() {
  return "p_" + Math.random().toString(36).substring(2, 10);
}

// Create room
btnCreateRoom.addEventListener("click", async () => {
  const name = hostNameInput.value.trim();
  if (!name) return;

  const roomCode = generateRoomCode();
  const roomRef = db.ref("rooms/" + roomCode);

  currentRoomId = roomCode;
  currentPlayerId = generatePlayerId();
  currentPlayerName = name;
  isHost = true;

  await roomRef.set({
    state: "lobby",
    hostId: currentPlayerId,
    players: {
      [currentPlayerId]: {
        id: currentPlayerId,
        name: currentPlayerName,
        alive: true
      }
    }
  });

  subscribeToRoom(roomCode);
  roomCodeDisplay.textContent = roomCode;
  playerNameDisplay.textContent = currentPlayerName;
  showScreen("screen-waiting-room");
});

localStorage.setItem("roomId", currentRoomId);
localStorage.setItem("playerId", currentPlayerId);
localStorage.setItem("playerName", currentPlayerName);
localStorage.setItem("isHost", isHost ? "1" : "0");

// Join room
btnJoinRoom.addEventListener("click", async () => {
  const roomCode = joinRoomCodeInput.value.trim().toUpperCase();
  const name = joinNameInput.value.trim();
  if (!roomCode || !name) return;

  const roomRef = db.ref("rooms/" + roomCode);
  const snapshot = await roomRef.get();
  if (!snapshot.exists()) {
    alert("Room not found");
    return;
  }

  currentRoomId = roomCode;
  currentPlayerId = generatePlayerId();
  currentPlayerName = name;
  isHost = false;

  await roomRef.child("players/" + currentPlayerId).set({
    id: currentPlayerId,
    name: currentPlayerName,
    alive: true
  });

  subscribeToRoom(roomCode);
  roomCodeDisplay.textContent = roomCode;
  playerNameDisplay.textContent = currentPlayerName;
  showScreen("screen-waiting-room");
});

// Subscribe to room changes
function subscribeToRoom(roomCode) {
  const roomRef = db.ref("rooms/" + roomCode);

  roomRef.on("value", snapshot => {
    const room = snapshot.val();
    if (!room) return;

    updatePlayerList(room.players || {});
    handleRoomState(room);
  });
}

function updatePlayerList(players) {
  playerListEl.innerHTML = "";
  Object.values(players).forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name + (p.alive ? "" : " (dead)");
    playerListEl.appendChild(li);
  });
}

// Host: start game
btnStartGame.addEventListener("click", async () => {
  if (!isHost || !currentRoomId) return;

  const roomRef = db.ref("rooms/" + currentRoomId);
  const snapshot = await roomRef.get();
  const room = snapshot.val();
  if (!room || !room.players) return;

  const playerIds = Object.keys(room.players);
  if (playerIds.length < 3) {
    alert("Need at least 3 players.");
    return;
  }

  const assignments = assignRolesToPlayers(playerIds);

  const updates = {};
  playerIds.forEach(pid => {
    updates["players/" + pid + "/roleId"] = assignments[pid];
  });
  updates["state"] = "roles";

  await roomRef.update(updates);
});

// Handle room state transitions
function handleRoomState(room) {
  const state = room.state;

  if (state === "lobby") {
    showScreen("screen-waiting-room");
    if (isHost) btnStartGame.style.display = "block";
    else btnStartGame.style.display = "none";
  }

  if (state === "roles") {
    const me = room.players[currentPlayerId];
    if (me && me.roleId && !currentRoleId) {
      currentRoleId = me.roleId;
      const role = getRoleById(currentRoleId);
      roleNameEl.textContent = role.name;
      roleDescriptionEl.textContent = role.description;
      showScreen("screen-role");
    }
  }

  if (state === "night") {
    setupNightPhase(room);
  }

  if (state === "day") {
    setupDayPhase(room);
  }

  if (state === "results") {
    setupResultsPhase(room);
  }
} // If it's night and all alive players with abilities have acted, resolve night
if (room.state === "night") {
  const actions = room.actions || {};
  const alivePlayers = Object.values(room.players).filter(p => p.alive);

  // Count how many players *should* act
  const requiredActors = alivePlayers.filter(p => {
    const role = getRoleById(p.roleId);
    return role.nightAbility !== null;
  });

  if (Object.keys(actions).length === requiredActors.length) {
    if (isHost) {
      resolveNight(room);
    }
  }
}
// If it's day and all alive players have voted, resolve voting
if (room.state === "day") {
  const votes = room.votes || {};
  const alivePlayers = Object.values(room.players).filter(p => p.alive);

  if (Object.keys(votes).length === alivePlayers.length) {
    if (isHost) {
      resolveDay(room);
    }
  }
}

// After seeing role, continue to night
btnContinueFromRole.addEventListener("click", async () => {
  if (!isHost || !currentRoomId) {
    // non-host just waits for host to change state
    return;
  }
  await db.ref("rooms/" + currentRoomId).update({
    state: "night"
  });
});

// Night phase (very basic)
function setupNightPhase(room) {
  showScreen("screen-night");
  const me = room.players[currentPlayerId];
  const role = getRoleById(me.roleId);

  if (!me.alive) {
    nightInstructionsEl.textContent = "You are dead. Wait for the next day.";
    nightActionContainer.innerHTML = "";
    return;
  }

  if (role.nightAbility === "kill" || role.nightAbility === "investigate") {
    nightInstructionsEl.textContent = role.nightAbility === "kill"
      ? "Choose a player to kill."
      : "Choose a player to investigate.";

    nightActionContainer.innerHTML = "";
    Object.values(room.players)
      .filter(p => p.id !== currentPlayerId && p.alive)
      .forEach(p => {
        const btn = document.createElement("button");
        btn.textContent = p.name;
        btn.addEventListener("click", () => submitNightAction(role.nightAbility, p.id));
        nightActionContainer.appendChild(btn);
      });
  } else {
    nightInstructionsEl.textContent = "You have no night action.";
    nightActionContainer.innerHTML = "";
  }
}

async function submitNightAction(type, targetId) {
  if (!currentRoomId || !currentPlayerId) return;
  await db.ref(`rooms/${currentRoomId}/actions/${currentPlayerId}`).set({
    type,
    targetId
  });
  nightInstructionsEl.textContent = "Action submitted. Waiting for others...";
  nightActionContainer.innerHTML = "";
}

// Day phase (simple voting)
function setupDayPhase(room) {
  showScreen("screen-day");
  voteContainer.innerHTML = "";

  const me = room.players[currentPlayerId];
  if (!me.alive) {
    voteContainer.textContent = "You are dead and cannot vote.";
    return;
  }

  Object.values(room.players)
    .filter(p => p.alive && p.id !== currentPlayerId)
    .forEach(p => {
      const btn = document.createElement("button");
      btn.textContent = p.name;
      btn.addEventListener("click", () => submitVote(p.id));
      voteContainer.appendChild(btn);
    });
}

async function submitVote(targetId) {
  if (!currentRoomId || !currentPlayerId) return;
  await db.ref(`rooms/${currentRoomId}/votes/${currentPlayerId}`).set({
    targetId
  });
  voteContainer.textContent = "Vote submitted. Waiting for others...";
}

// Results phase (placeholder)
function setupResultsPhase(room) {
  showScreen("screen-results");
  resultsTextEl.textContent = room.resultsText || "Placeholder results.";
}

// Host moves to next phase (you’ll later add logic here)
btnNextPhase.addEventListener("click", async () => {
  if (!isHost || !currentRoomId) return;

  const roomRef = db.ref("rooms/" + currentRoomId);
  const snapshot = await roomRef.get();
  const room = snapshot.val();
  if (!room) return;

  // Very naive state cycle: night -> day -> night
  if (room.state === "results") {
    await roomRef.update({ state: "night" });
  }
});

async function resolveNight(room) {
  const actions = room.actions || {};
  const players = room.players;

  let killTarget = null;
  let investigateResult = null;

  // Process each action
  Object.values(actions).forEach(action => {
    if (action.type === "kill") {
      killTarget = action.targetId;
    }
    if (action.type === "investigate") {
      const targetRole = players[action.targetId].roleId;
      const role = getRoleById(targetRole);
      investigateResult = `${players[action.targetId].name} is on team ${role.team}`;
    }
  });

  const updates = {};

  // Apply kill
  if (killTarget) {
    updates[`players/${killTarget}/alive`] = false;
  }

  // Store results text
  let results = "";
  if (killTarget) {
    results += `${players[killTarget].name} was killed during the night.\n`;
  } else {
    results += `No one died last night.\n`;
  }

  if (investigateResult) {
    results += `The Seer learned: ${investigateResult}`;
  }

  updates["resultsText"] = results;

  // Clear actions
  updates["actions"] = null;

  // Move to results phase
  updates["state"] = "results";

  await db.ref(`rooms/${currentRoomId}`).update(updates);
}
async function resolveDay(room) {
  const votes = room.votes || {};
  const players = room.players;

  // Count votes
  const tally = {};
  Object.values(votes).forEach(v => {
    if (!tally[v.targetId]) tally[v.targetId] = 0;
    tally[v.targetId]++;
  });

  // Determine who has the most votes
  let maxVotes = 0;
  let eliminatedPlayerId = null;

  Object.keys(tally).forEach(pid => {
    if (tally[pid] > maxVotes) {
  maxVotes = tally[pid];
  eliminatedPlayerId = pid;
} else if (tally[pid] === maxVotes) {
  eliminatedPlayerId = null; // tie = no elimination
}
  });

  const updates = {};

  // Apply elimination
  if (eliminatedPlayerId) {
    updates[`players/${eliminatedPlayerId}/alive`] = false;
  }

  // Build results text
  let results = "";
  if (eliminatedPlayerId) {
    results += `${players[eliminatedPlayerId].name} was voted out.\n`;
  } else {
    results += `No one was eliminated.\n`;
  }

  updates["resultsText"] = results;

  // Clear votes
  updates["votes"] = null;

  // Move to results phase
  updates["state"] = "results";

  await db.ref(`rooms/${currentRoomId}`).update(updates);
}
