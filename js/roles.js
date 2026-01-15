// js/roles.js
const ROLES = [
  {
    id: "villager",
    name: "Villager",
    team: "town",
    description: "You have no special powers. Find and eliminate the werewolves.",
    nightAbility: null
  },
  {
    id: "werewolf",
    name: "Werewolf",
    team: "wolf",
    description: "You are a werewolf. Work with other wolves to eliminate the town.",
    nightAbility: "kill"
  },
  {
    id: "seer",
    name: "Seer",
    team: "town",
    description: "Each night, you may learn whether a player is good or evil.",
    nightAbility: "investigate"
  }
];

// Helper to pick roles for N players (very naive for now)
function assignRolesToPlayers(playerIds) {
  // Example: 1 wolf, 1 seer, rest villagers
  const rolesPool = [];
  if (playerIds.length >= 3) {
    rolesPool.push("werewolf", "seer");
    while (rolesPool.length < playerIds.length) {
      rolesPool.push("villager");
    }
  } else {
    // fallback: all villagers
    while (rolesPool.length < playerIds.length) {
      rolesPool.push("villager");
    }
  }

  // Shuffle
  for (let i = rolesPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolesPool[i], rolesPool[j]] = [rolesPool[j], rolesPool[i]];
  }

  const assignments = {};
  playerIds.forEach((pid, index) => {
    assignments[pid] = rolesPool[index];
  });
  return assignments;
}

function getRoleById(id) {
  return ROLES.find(r => r.id === id);
}
