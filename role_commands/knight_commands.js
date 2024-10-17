const { eventEmitter } = require("../functions/eventEmitter.js");
const {
  buildSelectMenu,
  sendInteractionReply,
} = require("../functions/botActions");
const {
  CacheGetUserXP,
  CacheSetCooldown,
  CacheGetCooldown,
  CacheGetKnightWrits,
  CacheCheckActiveWrit,
  CacheUpdateWritStatus,
  CacheCheckAndUpdateUserWrits,
} = require("../apis/redis/redisCache");
const { DBUpdateXP } = require("../apis/firebase/querys.js");
const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  CutDownCost,
  CutDownCooldown,
  HighWritReward,
  EminentWritReward,
  RoyalWritReward,
  ImperialWritReward,
  SiegeTime,
  RoleChangeMessageDisplayTime,
  CoupCooldown,
  CoupFirstPhaseTime,
  CoupSecondPhaseTime,
  CoupKillNoble,
  CoupKillLord,
  CoupKillKing,
  CoupKillEmperor,
  EmperorElectionTime,
} = require("../game_config.json");

let selectedTargets = {};
let knights = [];
let knightsSize = 0;
let kingsSize = 1;
let siegeInitiatorUsername = null;
let siegeTargetName = null;
let siegeActive = false;
let siegeParticipants = new Set();
let siegeTimeout;
let coupParticipants = {};
let selectedCoupTargets = {};
let coupInitiatorId = null;
let coupInitiator = null;
let coupTimeout;
let coupActive = false;
let coupSecondPhase = false;
let emperorElectionActive = false;
let selectedEmperor = {};
let emperorElectionParticipants = {};
let reelectionActive = false;
let candidates = null;

const initContent =
  "Test message to Knight.\n" +
  "**Abilities:**\n" +
  "- **Cut down**: Description goes here.\n" +
  "- **Writ**: Description goes here.\n" +
  "- **Join Siege**: Siege a king to make him a poop.\n" +
  "- **Coup**: Choose Noble, Lord, King or Emperor.";

// Change threadshold
const COUPTHREADSHOLD = 0.4;

function showErrorMsg(err) {
  console.error("ERROR: knight_commands.js", err);
}

async function setupKnightBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const hadRoleBeforePeasant = oldMember.roles.cache.has(
      process.env.ROLEID_PEASANT
    );
    const hasRoleNowPeasant = newMember.roles.cache.has(
      process.env.ROLEID_PEASANT
    );
    const hadRoleBeforeScholar = oldMember.roles.cache.has(
      process.env.ROLEID_SCHOLAR
    );
    const hasRoleNowScholar = newMember.roles.cache.has(
      process.env.ROLEID_SCHOLAR
    );
    const hadRoleBeforeMerchant = oldMember.roles.cache.has(
      process.env.ROLEID_MERCHANT
    );
    const hasRoleNowMerchant = newMember.roles.cache.has(
      process.env.ROLEID_MERCHANT
    );
    const hadRoleBeforeKnight = oldMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );
    const hasRoleNowKnight = newMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );
    const hadRoleBeforeKing = oldMember.roles.cache.has(
      process.env.ROLEID_KING
    );
    const hasRoleNowKing = newMember.roles.cache.has(process.env.ROLEID_KING);
    const hadRoleBeforeNoble = oldMember.roles.cache.has(
      process.env.ROLEID_NOBLE
    );
    const hasRoleNowNoble = newMember.roles.cache.has(process.env.ROLEID_NOBLE);
    const hadRoleBeforeLord = oldMember.roles.cache.has(
      process.env.ROLEID_LORD
    );
    const hasRoleNowLord = newMember.roles.cache.has(process.env.ROLEID_LORD);
    const hadRoleBeforeEmperor = oldMember.roles.cache.has(
      process.env.ROLEID_EMPEROR
    );
    const hasRoleNowEmperor = newMember.roles.cache.has(
      process.env.ROLEID_EMPEROR
    );

    if (
      hadRoleBeforePeasant ||
      hadRoleBeforeScholar ||
      hadRoleBeforeMerchant ||
      hadRoleBeforeNoble ||
      hadRoleBeforeLord ||
      hadRoleBeforeKing
    ) {
      await CacheCheckAndUpdateUserWrits(oldMember.id);
      for (let userId in selectedTargets) {
        if (
          selectedTargets[userId] &&
          selectedTargets[userId].id === oldMember.id
        ) {
          delete selectedTargets[userId];
          console.log(
            `Removed ${oldMember.user.username} from Cut Dowm targets`
          );
        }
      }
    }
    if (
      hadRoleBeforePeasant ||
      hadRoleBeforeScholar ||
      hadRoleBeforeMerchant ||
      hadRoleBeforeNoble ||
      hadRoleBeforeLord ||
      hadRoleBeforeKing ||
      hadRoleBeforeEmperor ||
      hasRoleNowPeasant ||
      hasRoleNowScholar ||
      hasRoleNowMerchant ||
      hasRoleNowNoble ||
      hasRoleNowLord ||
      hasRoleNowKing ||
      hasRoleNowEmperor
    ) {
      await updateMessage(client, lastMessageId);
    }

    if (hadRoleBeforeKnight) {
      if (siegeActive) {
        if (siegeParticipants.has(newMember.id)) {
          try {
            siegeParticipants.delete(newMember.id);
          } catch (err) {
            showErrorMsg(err);
          }
        }
      }
      if (coupActive) {
        if (
          Object.keys(coupParticipants).findIndex(
            (key) => key === newMember.id
          ) > -1
        ) {
          delete coupParticipants[newMember.id];
        }
      }
    }

    if (
      hadRoleBeforeKnight ||
      hasRoleNowKnight ||
      hadRoleBeforeKing ||
      hasRoleNowKing
    ) {
      if (lastMessageId) {
        try {
          const guild = await client.guilds.fetch(process.env.GUILDID);
          knights = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_KNIGHT)
          );
          knightsSize = knights.size;
          const kings = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_KING)
          );
          kingsSize = kings.size;

          const siegeSuccess =
            siegeParticipants.size >= knightsSize / kingsSize;
          if (siegeActive && siegeSuccess) {
            siegeActive = false;
            ceaseSiege(client, lastMessageId);
            return;
          } else if (coupActive && coupSecondPhase) {
            if (
              Object.keys(coupParticipants).length / knightsSize <=
              COUPTHREADSHOLD
            ) {
              ceaseCoup(client, lastMessageId);
            }
          } else {
            await updateMessage(client, lastMessageId);
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
  });
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    const userId = interaction.user.id;
    if (interaction.customId === "SelectCutDown") {
      let selectedTargetId = interaction.values[0];
      try {
        selectedTargets[userId] = await interaction.guild.members.cache.get(
          selectedTargetId
        );
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "SelectCoupTarget") {
      let selectedTargetId = interaction.values[0];
      try {
        selectedCoupTargets[userId] = await interaction.guild.members.cache.get(
          selectedTargetId
        );
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "SelectEmperorCandidate") {
      const userId = interaction.user.id;
      let selectedCandidateId = interaction.values[0];
      try {
        selectedEmperor[userId] = await interaction.guild.members.cache.get(
          selectedCandidateId
        );
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "CutDown") {
      try {
        if (!selectedTargets[userId]) {
          await sendInteractionReply(interaction, `No scoundrel selected...`);
          return;
        }

        const targetId = selectedTargets[userId].id;
        const targetRoles = selectedTargets[userId].roles.cache;
        const userXP = await CacheGetUserXP(userId);

        // Check if target has a role that requires a writ
        const requiresWrit =
          targetRoles.has(process.env.ROLEID_KNIGHT) ||
          targetRoles.has(process.env.ROLEID_NOBLE) ||
          targetRoles.has(process.env.ROLEID_LORD) ||
          targetRoles.has(process.env.ROLEID_KING);

        if (requiresWrit) {
          // Check for active writs
          const hasWrit2 = await CacheCheckActiveWrit(userId, targetId, 2);
          const hasWrit3 = await CacheCheckActiveWrit(userId, targetId, 3);
          const hasWrit4 = await CacheCheckActiveWrit(userId, targetId, 4);

          let validWrit = null;
          if (hasWrit4) validWrit = 4;
          else if (hasWrit3 && !targetRoles.has(process.env.ROLEID_KING))
            validWrit = 3;
          else if (
            hasWrit2 &&
            !targetRoles.has(process.env.ROLEID_LORD) &&
            !targetRoles.has(process.env.ROLEID_KING)
          )
            validWrit = 2;

          if (!validWrit) {
            await sendInteractionReply(
              interaction,
              "Target only available with appropriate writ"
            );
            return;
          }

          // Execute writ
          await executeCutDown(
            interaction,
            userId,
            targetId,
            userXP,
            validWrit,
            client
          );
        } else {
          // No writ required
          const activeWrit = await CacheCheckActiveWrit(userId, targetId);
          if (activeWrit) {
            await executeCutDown(
              interaction,
              userId,
              targetId,
              userXP,
              activeWrit
            );
          } else {
            if (userXP < CutDownCost) {
              await sendInteractionReply(
                interaction,
                `Not enough XP (current XP: ${userXP})`
              );
              return;
            }
            await DBUpdateXP(userId, -CutDownCost, client);
            await performCutDown(interaction, targetId);
            await sendInteractionReply(
              interaction,
              `(${
                userXP - CutDownCost
              } XP left) Cut Down successful with no writ`
            );
          }
        }

        selectedTargets[userId] = null;
      } catch (err) {
        showErrorMsg(err);
      }
    }
    if (interaction.customId === "ShowWrits") {
      await handleShowWrits(interaction);
    }

    if (interaction.customId === "JoinSiege") {
      try {
        if (!siegeActive) {
          await sendInteractionReply(
            interaction,
            "There is no active siege to join."
          );
          return;
        }

        const userId = interaction.user.id;

        if (siegeParticipants.has(userId)) {
          await sendInteractionReply(
            interaction,
            "You've already joined this siege."
          );
          return;
        }

        siegeParticipants.add(userId);
        await sendInteractionReply(interaction, "You have joind the siege.");

        const success = siegeParticipants.size >= knightsSize / kingsSize;
        if (siegeActive && success) {
          siegeActive = false;
          ceaseSiege(client, lastMessageId);
          return;
        } else {
          await updateMessage(client, lastMessageId);
          eventEmitter.emit(
            "KnightParticipatedOnSiege",
            siegeParticipants.size,
            knightsSize
          );
        }
      } catch (err) {
        throw err;
      }
    }

    if (interaction.customId === "Coup") {
      const userId = interaction.user.id;
      if (!selectedCoupTargets[userId]) {
        await sendInteractionReply(interaction, "No member selected");
        return;
      }

      let cooldown;
      try {
        cooldown = await CacheGetCooldown("Coup", userId);
      } catch (err) {
        showErrorMsg(err);
      }
      if (cooldown) {
        await sendInteractionReply(interaction, "Coup is on cooldown");
        return;
      }

      if (lastMessageId) {
        try {
          const target = selectedCoupTargets[userId];
          coupParticipants[userId] = {
            targetId: target.user.id,
            roles: target.roles.cache,
          };

          // Set cooldown
          await CacheSetCooldown("Coup", userId, CoupCooldown);

          coupInitiatorId = userId;
          coupInitiator = interaction.user.username;

          const guild = await client.guilds.fetch(process.env.GUILDID);
          knights = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_KNIGHT)
          );
          knightsSize = knights.size;

          await startFirstPhaseCoup(client, lastMessageId, CoupFirstPhaseTime);

          await updateMessage(client, lastMessageId);

          await sendInteractionReply(
            interaction,
            `You have successfully initiated coup with target @${target.user.username}. Wait for the knights to join.`
          );
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }

    if (interaction.customId === "JoinCoup") {
      if (!selectedCoupTargets[userId]) {
        await sendInteractionReply(interaction, "No member selected");
        return;
      }

      if (
        Object.keys(coupParticipants).findIndex((key) => key === userId) > -1
      ) {
        await sendInteractionReply(interaction, "You've already joined coup.");
        return;
      }

      const target = selectedCoupTargets[userId];
      coupParticipants[userId] = {
        targetId: target.user.id,
        roles: target.roles.cache,
      };

      await updateMessage(client, lastMessageId);

      await sendInteractionReply(
        interaction,
        `You have joined the coup with target @${target.user.username}.`
      );
    }

    if (interaction.customId === "VoteEmperor") {
      try {
        if (!emperorElectionActive) {
          await sendInteractionReply(
            interaction,
            "There is no active election to vote."
          );
          return;
        }

        const userId = interaction.user.id;
        if (!selectedEmperor[userId]) {
          await sendInteractionReply(interaction, "No member selected");
          return;
        }

        if (
          Object.keys(emperorElectionParticipants).findIndex(
            (key) => key === userId
          ) > -1
        ) {
          await sendInteractionReply(
            interaction,
            "You've already joined the election."
          );
          return;
        }

        const candidate = selectedEmperor[userId];
        emperorElectionParticipants[userId] = candidate.user.id;

        await sendInteractionReply(
          interaction,
          "You have joined the election."
        );
      } catch (err) {
        throw err;
      }
    }
  });

  eventEmitter.on("siegeStarted", async (initiatorUsername, targetName) => {
    try {
      if (lastMessageId) {
        const guild = await client.guilds.fetch(process.env.GUILDID);
        knights = guild.members.cache.filter((member) =>
          member.roles.cache.has(process.env.ROLEID_KNIGHT)
        );
        const kings = guild.members.cache.filter((member) =>
          member.roles.cache.has(process.env.ROLEID_KING)
        );
        knightsSize = knights.size;
        kingsSize = kings.size;
        siegeActive = true;
        siegeInitiatorUsername = initiatorUsername;
        siegeTargetName = targetName;

        startSiege(client, lastMessageId, SiegeTime);
        updateMessage(client, lastMessageId);
      }
    } catch (err) {
      showErrorMsg(err);
    }
  });
  eventEmitter.on("siegeResult", async (message, status) => {
    try {
      if (status === "early") {
        ceaseSiege(client, lastMessageId);
      }
      eventEmitter.emit("NotifyKnightChannel", message);
    } catch (err) {
      showErrorMsg(err);
    }
  });
  eventEmitter.on("NotifyKnightChannel", async (content) => {
    try {
      let channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
      const message = await channel.send({
        content,
      });
      setTimeout(async () => {
        await message.delete().catch(console.error);
      }, RoleChangeMessageDisplayTime);
    } catch (err) {
      showErrorMsg(err);
    }
  });
}

async function startSiege(client, lastMessageId, timeout) {
  siegeTimeout = setTimeout(async () => {
    await handleSiegeEnd(client, lastMessageId);
  }, timeout);
}

async function handleSiegeEnd(client, lastMessageId) {
  siegeActive = false;
  eventEmitter.emit("SiegeFinished", siegeParticipants.size, knightsSize);
  eventEmitter.emit("NotifyKnightChannel", "Siege finished.");
  await resetComponents(client, lastMessageId);
}

async function ceaseSiege(client, lastMessageId) {
  if (siegeTimeout) {
    clearTimeout(siegeTimeout);
    await handleSiegeEnd(client, lastMessageId);
  }
}

async function handleShowWrits(interaction) {
  try {
    const knightId = interaction.user.id;
    const writs = await CacheGetKnightWrits(knightId);

    if (writs.length === 0) {
      await sendInteractionReply(interaction, "You have no active writs.");
      return;
    }

    const writDescriptions = writs.map((writ, index) => {
      return `${index + 1}. Type: ${getWritType(writ.writType)}, Target: <@${
        writ.targetId
      }>, Status: ${getWritStatus(writ.writStatus)}, Message: ${
        writ.writMessage
      }`;
    });

    const response = `Your active writs:\n\n${writDescriptions.join("\n")}`;

    await sendInteractionReply(interaction, response);
  } catch (error) {
    console.error("Error in handleShowWrits:", error);
    await sendInteractionReply(
      interaction,
      "An error occurred while fetching your writs."
    );
  }
}

function getWritType(writType) {
  switch (writType) {
    case 1:
    return "High";
    case 2:
      return "Eminent";
    case 3:
      return "Royal";
    case 4:
      return "Imperial";
    default:
      throw new Error("Invalid writ type");
  }
}

function getWritStatus(status) {
  switch (status) {
    case 0:
      return "to be executed";
    case 1:
      return "Executed";
    case 2:
      return "Failed";
    case 3:
      return "Anulled, knight or target have changed roles";
    default:
      showErrorMsg("Writ status incorrect");
  }
}

async function executeCutDown(interaction, userId, targetId, userXP, client) {
  const cooldown = await CacheGetCooldown("cutdown", userId);
  if (cooldown) {
    await sendInteractionReply(
      interaction,
      "Cut Down is on cooldown and cannot be used"
    );
    return;
  }

  // Get all active writs for this knight and target
  const activeWrits = await CacheGetKnightWrits(userId);
  const relevantWrits = activeWrits.filter(
    (writ) => writ.targetId === targetId && writ.writStatus === 0
  );

  if (relevantWrits.length === 0) {
    // No writs found, proceed with normal Cut Down
    if (userXP < CutDownCost) {
      await sendInteractionReply(
        interaction,
        `Not enough XP (current XP: ${userXP})`
      );
      return;
    }
    await DBUpdateXP(userId, -CutDownCost, client);
    await performCutDown(interaction, targetId);
    await sendInteractionReply(
      interaction,
      `(${userXP - CutDownCost} XP left) Cut Down successful with no writ`
    );
    return;
  }

  // Calculate total XP reward
  let totalXpReward = 0;
  for (const writ of relevantWrits) {
    let xpReward;
    switch (writ.writType) {
      case 1:
        xpReward = HighWritReward;
        break;
      case 2:
        xpReward = EminentWritReward;
        break;
      case 3:
        xpReward = RoyalWritReward;
        break;
      case 4:
        xpReward = ImperialWritReward;
        break;
      default:
        showErrorMsg("Writ type incorrect");
    }
    totalXpReward += xpReward;

    // Update writ status
    await CacheUpdateWritStatus(
      writ.writType,
      writ.writerId,
      userId,
      targetId,
      1
    );
  }

  // Apply XP reward and perform Cut Down
  await DBUpdateXP(userId, totalXpReward, client);
  await CacheSetCooldown("cutdown", userId, CutDownCooldown);
  await performCutDown(interaction, targetId);

  const newXP = parseInt(userXP) + totalXpReward;
  const writDetails = relevantWrits
    .map((writ) => `type ${writ.writType}`)
    .join(", ");
  await sendInteractionReply(
    interaction,
    `(${newXP} XP) Cut Down successful. Executed ${relevantWrits.length} writ(s): ${writDetails}. Total reward: ${totalXpReward} XP`
  );
}

async function performCutDown(interaction, targetId) {
  const target = await interaction.guild.members.fetch(targetId);
  eventEmitter.emit("changeRole", target, "Poop");
  eventEmitter.emit(
    "CutDownComplete",
    target.user.username,
    interaction.user.username
  );
}

async function startFirstPhaseCoup(client, lastMessageId, timeout) {
  coupActive = true;
  setTimeout(async () => {
    await handleFirstPhaseCoupEnd(client, lastMessageId);
  }, timeout);
}

async function handleFirstPhaseCoupEnd(client, lastMessageId) {
  const success =
    Object.keys(coupParticipants).length / knightsSize > COUPTHREADSHOLD;
  if (success) {
    const msg = `The initial phase of coup initiated by @${coupInitiator} is succeeded, moving to the next phase`;
    eventEmitter.emit("NotifyKnightChannel", msg);
    startSecondPhaseCoup(client, lastMessageId, CoupSecondPhaseTime);
  } else {
    const msg = `The coup initiated by @${coupInitiator} is failed, resetting the poll.`;
    eventEmitter.emit("NotifyKnightChannel", msg);
    await resetComponents(client, lastMessageId);
  }
}

async function startSecondPhaseCoup(client, lastMessageId, timeout) {
  coupSecondPhase = true;
  await updateMessage(client, lastMessageId);
  coupTimeout = setTimeout(async () => {
    await handleSecondPhaseCoupEnd(client, lastMessageId);
  }, timeout);
}

async function handleSecondPhaseCoupEnd(client, lastMessageId) {
  const refinedTargets = {};
  Object.keys(coupParticipants).forEach((userId) => {
    const targetId = coupParticipants[userId].targetId;
    let targetedNumber = 1;
    Object.keys(coupParticipants).forEach((otherUserId) => {
      const otherTargetId = coupParticipants[otherUserId].targetId;
      if (userId !== otherUserId && targetId === otherTargetId)
        targetedNumber++;
    });
    refinedTargets[targetId] = {
      targetedNumber,
      roles: coupParticipants[userId].roles,
    };
  });

  let isEmperorDead = false;
  Object.keys(refinedTargets).forEach(async (targetId) => {
    let killTarget = false;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_NOBLE) &&
      refinedTargets[targetId].targetedNumber > CoupKillNoble
    )
      killTarget = true;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_LORD) &&
      refinedTargets[targetId].targetedNumber > CoupKillLord
    )
      killTarget = true;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_KING) &&
      refinedTargets[targetId].targetedNumber > CoupKillKing
    )
      killTarget = true;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_EMPEROR) &&
      refinedTargets[targetId].targetedNumber > CoupKillEmperor
    ) {
      killTarget = true;
      isEmperorDead = true;
    }

    if (killTarget) {
      const guild = await client.guilds.fetch(process.env.GUILDID);
      const target = await guild.members.fetch(targetId);
      eventEmitter.emit("changeRole", target, "Poop");
      eventEmitter.emit(
        "NotifyKnightChannel",
        `@${target.user.username} has been killed by coup.`
      );
    }
  });

  if (isEmperorDead) {
    eventEmitter.emit(
      "NotifyKnightChannel",
      `The emperor is dead. Let's vote for new emperor.`
    );
    startEmperorElection(client, lastMessageId, EmperorElectionTime);
  } else {
    eventEmitter.emit("NotifyKnightChannel", `Coup finished.`);
    resetComponents(client, lastMessageId);
  }
}

async function ceaseCoup(client, lastMessageId) {
  if (coupTimeout) {
    clearTimeout(coupTimeout);
    eventEmitter.emit(
      "NotifyKnightChannel",
      "Coup failed because of insufficient number of knights."
    );
    await resetComponents(client, lastMessageId);
  }
}

async function startEmperorElection(client, lastMessageId, timeout) {
  emperorElectionActive = true;
  await updateMessage(client, lastMessageId);

  setTimeout(async () => {
    await handleEmperorElectionEnd(client, lastMessageId);
  }, timeout);
}

async function handleEmperorElectionEnd(client, lastMessageId) {
  const refinedCandidates = {};
  let maximumVotes = 1;
  Object.keys(emperorElectionParticipants).forEach((userId) => {
    const candidateId = emperorElectionParticipants[userId];
    let votes = 1;
    Object.keys(emperorElectionParticipants).forEach((otherUserId) => {
      const otherCandidateId = emperorElectionParticipants[otherUserId];
      if (userId !== otherUserId && candidateId === otherCandidateId) votes++;
    });
    refinedCandidates[candidateId] = votes;
    if (votes > maximumVotes) maximumVotes = votes;
  });

  let maxCandidates = [];
  Object.keys(refinedCandidates).forEach(async (candidateId) => {
    if (refinedCandidates[candidateId] === maximumVotes)
      maxCandidates.push(candidateId);
  });

  if (maxCandidates.length === 1) {
    const guild = await client.guilds.fetch(process.env.GUILDID);
    const target = await guild.members.fetch(maxCandidates[0]);
    eventEmitter.emit("changeRole", target, "Emperor");
    eventEmitter.emit(
      "NotifyKnightChannel",
      `Congrats! @${target.user.username} has been elected as new emperor.`
    );
    resetComponents(client, lastMessageId);
  } else {
    eventEmitter.emit(
      "NotifyKnightChannel",
      `${maxCandidates.length} candidates have same votes. Starting reelection...`
    );
    reelectionActive = true;
    const guild = await client.guilds.fetch(process.env.GUILDID);
    candidates = maxCandidates.map(async (candidateId) => {
      const candidate = await guild.members.fetch(candidateId);
      return { label: candidate.user.username, value: candidate.id };
    });

    await updateMessage(client, lastMessageId);

    emperorElectionParticipants = {};
    selectedEmperor = {};

    setTimeout(async () => {
      await handleEmperorElectionEnd(client, lastMessageId);
    }, EmperorElectionTime);
  }
}

async function updateMessage(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
    const messageToEdit = await channel.messages.fetch(lastMessageId);

    if (siegeActive) {
      const actionRow_0 = ActionRowBuilder.from(
        messageToEdit.components[0].toJSON()
      );
      const actionRow_1 = ActionRowBuilder.from(
        messageToEdit.components[1].toJSON()
      );
      const btnRow_1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("CutDown")
          .setLabel("Cut Down")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("JoinSiege")
          .setLabel("Join Siege")
          .setStyle(ButtonStyle.Primary)
      );
      const btnRow_2 = ActionRowBuilder.from(
        messageToEdit.components[3].toJSON()
      );

      await messageToEdit.edit({
        content:
          initContent +
          `\nKing @${siegeInitiatorUsername} initiated a siege. Join siege to downgrade ${siegeTargetName}. (Joined ${siegeParticipants.size} / ${knightsSize}.)`,
        components: [actionRow_0, actionRow_1, btnRow_1, btnRow_2],
      });
    }

    if (coupActive) {
      if (!emperorElectionActive) {
        const actionRow_0 = ActionRowBuilder.from(
          messageToEdit.components[0].toJSON()
        );
        const actionRow_1 = new ActionRowBuilder().addComponents(
          await buildSelectMenu(
            client,
            ["noble", "lord", "king", "emperor"],
            "SelectCoupTarget"
          )
        );
        const btnRow_1 = ActionRowBuilder.from(
          messageToEdit.components[2].toJSON()
        );
        const btnRow_2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ShowWrits")
            .setLabel("Read yer writs")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("JoinCoup")
            .setLabel("Join Coup")
            .setStyle(ButtonStyle.Danger)
        );

        let content =
          initContent +
          `\n\n@${coupInitiator} initiated a coup. Join coup with selected target. (Joined ${
            Object.keys(coupParticipants).length
          } / ${knightsSize} knights.)`;
        if (coupSecondPhase)
          content =
            initContent +
            `\n\nCoup initiated by @${coupInitiator} is in the next phase. Join coup with selected target. (Joined ${
              Object.keys(coupParticipants).length
            } / ${knightsSize} knights.)`;

        await messageToEdit.edit({
          content,
          components: [actionRow_0, actionRow_1, btnRow_1, btnRow_2],
        });
      } else {
        if (reelectionActive) {
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );
          const actionRow_1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("SelectEmperorUser")
              .setPlaceholder("Choose a candidate")
              .addOptions(candidates)
          );
          const btnRow_1 = ActionRowBuilder.from(
            messageToEdit.components[2].toJSON()
          );
          const btnRow_2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("ShowWrits")
              .setLabel("Read yer writs")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("VoteEmperor")
              .setLabel("Vote")
              .setStyle(ButtonStyle.Danger)
          );

          const content =
            initContent +
            `\n\nEmperor must be only one! Let's reelect an emperor. Select a candidate and vote.`;

          await messageToEdit.edit({
            content,
            components: [actionRow_0, actionRow_1, btnRow_1, btnRow_2],
          });
        } else {
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );
          const actionRow_1 = new ActionRowBuilder().addComponents(
            await buildSelectMenu(
              client,
              ["noble", "lord", "king", "knight"],
              "SelectEmperorCandidate"
            )
          );
          const btnRow_1 = ActionRowBuilder.from(
            messageToEdit.components[2].toJSON()
          );
          const btnRow_2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("ShowWrits")
              .setLabel("Read yer writs")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("VoteEmperor")
              .setLabel("Vote")
              .setStyle(ButtonStyle.Danger)
          );

          const content =
            initContent +
            `\n\nThe emperor is dead as a result of coup. Elect new emperor.`;

          await messageToEdit.edit({
            content,
            components: [actionRow_0, actionRow_1, btnRow_1, btnRow_2],
          });
        }
      }
    }

    if (!coupActive && !siegeActive) {
      const cutDownSelectMenu = new ActionRowBuilder().addComponents(
        await buildSelectMenu(
          client,
          ["peasant", "scholar", "merchant", "noble", "lord", "king"],
          "SelectCutDown"
        )
      );
      const coupSelectMenu = new ActionRowBuilder().addComponents(
        await buildSelectMenu(
          client,
          ["noble", "lord", "king", "emperor"],
          "SelectCoupTarget"
        )
      );
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("CutDown")
          .setLabel("Cut Down")
          .setStyle(ButtonStyle.Primary)
      );
      const infoBtnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ShowWrits")
          .setLabel("Read yer writs")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("Coup")
          .setLabel("Coup")
          .setStyle(ButtonStyle.Danger)
      );

      await messageToEdit.edit({
        content: initContent,
        components: [cutDownSelectMenu, coupSelectMenu, btnRow, infoBtnRow],
      });
    }
  } catch (err) {
    showErrorMsg(err);
  }
}

async function messageKnightCommands(client) {
  let channel = null;
  try {
    channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
    const cutDownSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["peasant", "scholar", "merchant", "noble", "lord", "king"],
        "SelectCutDown"
      )
    );
    const coupSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["noble", "lord", "king", "emperor"],
        "SelectCoupTarget"
      )
    );
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("CutDown")
        .setLabel("Cut Down")
        .setStyle(ButtonStyle.Primary)
    );
    const infoBtnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ShowWrits")
        .setLabel("Read yer writs")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("Coup")
        .setLabel("Coup")
        .setStyle(ButtonStyle.Danger)
    );

    const message = await channel.send({
      content: initContent,
      components: [cutDownSelectMenu, coupSelectMenu, btnRow, infoBtnRow],
    });
    return message;
  } catch (err) {
    console.error(err);
    return;
  }
}

async function resetComponents(client, lastMessageId) {
  try {
    siegeActive = false;
    siegeInitiatorUsername = "";
    siegeTargetName = "";
    siegeParticipants.clear();
    knightsSize = 1;
    knights = [];
    selectedTargets = {};
    coupParticipants = {};
    selectedCoupTargets = {};
    coupInitiator = "";
    coupActive = false;
    coupSecondPhase = false;
    emperorElectionActive = false;
    reelectionActive = false;
    candidates = null;
    await updateMessage(client, lastMessageId);
  } catch (err) {
    throw err;
  }
}

module.exports = { setupKnightBotEvents, messageKnightCommands };
