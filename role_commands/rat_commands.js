const { eventEmitter } = require("../functions/eventEmitter.js");
const {
  sendInteractionReply,
  buildSelectMenu,
} = require("../functions/botActions");
const {
  CacheGetUserXP,
  CacheGetCooldown,
  CacheSetCooldown,
} = require("../apis/redis/redisCache");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const {
  NibbleCost,
  NibbleCooldown,
  PlagueCooldown,
  PlagueFirstPhaseTime,
  PlagueSecondPhaseTime,
  PlagueKillSubhuman,
  PlagueKillPeasant,
  PlagueKillScholar,
  PlagueKillMerchant,
  PlagueKillKnight,
  RoleChangeMessageDisplayTime,
} = require("../game_config.json");
const { DBUpdateXP } = require("../apis/firebase/querys");

const initContent =
  "Test message to Rat.\n" +
  "**Abilities:**\n" +
  "- **Nibble**: Choose Cockroach or Maggot to nibble\n" +
  "- **Plague**: Choose Sub-Human, Peasant, Scholar, Merchant or Knight to plague";

function showErrorMsg(err) {
  console.error("ERROR: rat_commands.js", err);
}

// Change threadshold
const PLAGUETHREADSHOLD = 1;

let selectedTargets = {};
let plagueParticipants = {};
let selectedPlagueTargets = {};
let plagueInitiator = null;
let plagueTimeout;
let plagueActive = false;
let secondPhase = false;
let rats = [];
let ratsSize = 0;

async function setupRatBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const hadRoleBeforeRat = oldMember.roles.cache.has(process.env.ROLEID_RAT);
    const hadRoleBeforeMaggot = oldMember.roles.cache.has(
      process.env.ROLEID_MAGGOT
    );
    const hadRoleBeforeCockroach = oldMember.roles.cache.has(
      process.env.ROLEID_COCKROACH
    );
    const hadRoleBeforeSubhuman = oldMember.roles.cache.has(
      process.env.ROLEID_SUBHUMAN
    );
    const hadRoleBeforePeasant = oldMember.roles.cache.has(
      process.env.ROLEID_PEASANT
    );
    const hadRoleBeforeMerchant = oldMember.roles.cache.has(
      process.env.ROLEID_MERCHANT
    );
    const hadRoleBeforeScholar = oldMember.roles.cache.has(
      process.env.ROLEID_SCHOLAR
    );
    const hadRoleBeforeKnight = oldMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );
    const hasRoleNowRat = newMember.roles.cache.has(process.env.ROLEID_RAT);
    const hasRoleNowMaggot = newMember.roles.cache.has(
      process.env.ROLEID_MAGGOT
    );
    const hasRoleNowCockroach = newMember.roles.cache.has(
      process.env.ROLEID_COCKROACH
    );
    const hasRoleNowSubhuman = newMember.roles.cache.has(
      process.env.ROLEID_SUBHUMAN
    );
    const hasRoleNowPeasant = newMember.roles.cache.has(
      process.env.ROLEID_PEASANT
    );
    const hasRoleNowMerchant = newMember.roles.cache.has(
      process.env.ROLEID_MERCHANT
    );
    const hasRoleNowScholar = newMember.roles.cache.has(
      process.env.ROLEID_SCHOLAR
    );
    const hasRoleNowKnight = newMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );

    if (plagueActive && hadRoleBeforeRat) {
      if (
        Object.keys(plagueParticipants).findIndex(
          (key) => key === newMember.id
        ) > -1
      ) {
        delete plagueParticipants[newMember.id];
        if (secondPhase) {
          if (Object.keys(plagueParticipants).length <= PLAGUETHREADSHOLD) {
            ceasePlague(client, lastMessageId);
            return;
          }
        }

        await updateMessage(client, lastMessageId);
      }
    }

    if (hadRoleBeforeMaggot || hadRoleBeforeCockroach) {
      for (let userId in selectedTargets) {
        if (
          selectedTargets[userId] &&
          selectedTargets[userId].id === oldMember.id
        ) {
          delete selectedTargets[userId];
          console.log(
            `Removed ${oldMember.user.username} from Nibble selectedTargets`
          );
        }
      }
    }
    if (plagueActive && hasRoleNowRat) {
        const guild = await client.guilds.fetch(process.env.GUILDID);
        await guild.members.fetch();
        rats = guild.members.cache.filter((member) =>
          member.roles.cache.has(process.env.ROLEID_RAT)
        );
        ratsSize = rats.size;

        await updateMessage(client, lastMessageId);
    }
    if (
      hadRoleBeforeCockroach ||
      hadRoleBeforeMaggot ||
      hadRoleBeforeSubhuman ||
      hadRoleBeforePeasant ||
      hadRoleBeforeMerchant ||
      hadRoleBeforeScholar ||
      hadRoleBeforeKnight ||
      hasRoleNowCockroach ||
      hasRoleNowMaggot ||
      hasRoleNowSubhuman ||
      hasRoleNowPeasant ||
      hasRoleNowMerchant ||
      hasRoleNowScholar ||
      hasRoleNowKnight
    ) {
      await updateMessage(client, lastMessageId);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
    if (interaction.customId === "SelectNibbleUser") {
      const userId = interaction.user.id;
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

    if (interaction.customId === "SelectPlagueTarget") {
      const userId = interaction.user.id;
      let selectedTargetId = interaction.values[0];
      try {
        selectedPlagueTargets[userId] =
          await interaction.guild.members.cache.get(selectedTargetId);
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "Nibble") {
      try {
        if (!selectedTargets[userId]) {
          await sendInteractionReply(
            interaction,
            `No maggot or rat selected...`
          );
          return;
        }
        const userXP = await CacheGetUserXP(userId);
        if (userXP < NibbleCost) {
          await sendInteractionReply(
            interaction,
            `Not enough XP (current XP: ${userXP})`
          );
          return;
        } else {
          const cooldown = await CacheGetCooldown("nibble", userId);
          if (cooldown) {
            await sendInteractionReply(
              interaction,
              "Nibble is on cooldown and cannot be used"
            );
            return;
          } else {
            eventEmitter.emit("changeRole", selectedTargets[userId], "Poop");
            await DBUpdateXP(userId, -NibbleCost, client);
            await CacheSetCooldown("nibble", userId, NibbleCooldown);
            eventEmitter.emit(
              "NibbleComplete",
              selectedTargets[userId].user.username,
              interaction.user.username
            );
            const XPLeft = parseInt(userXP) - parseInt(NibbleCost);
            await sendInteractionReply(
              interaction,
              `(${XPLeft} XP left) Nibble committed successfully.\n${selectedTargets[userId].user.username} has been reduced to poop`
            );
          }
        }
      } catch (err) {
        showErrorMsg(err);
      }
      selectedTargets[userId] = null;
    }

    if (interaction.customId === "Plague") {
      const userId = interaction.user.id;
      if (!selectedPlagueTargets[userId]) {
        await sendInteractionReply(interaction, "No member selected");
        return;
      }

      let cooldown;
      try {
        cooldown = await CacheGetCooldown("Plague", userId);
      } catch (err) {
        showErrorMsg(err);
      }
      if (cooldown) {
        await sendInteractionReply(interaction, "Plague is on cooldown");
        return;
      }

      if (lastMessageId) {
        try {
          const target = selectedPlagueTargets[userId];
          plagueParticipants[userId] = {
            targetId: target.user.id,
            roles: target.roles.cache,
          };

          // Set cooldown
          await CacheSetCooldown("Plague", userId, PlagueCooldown);

          const guild = await client.guilds.fetch(process.env.GUILDID);
          await guild.members.fetch();
          rats = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_RAT)
          );
          ratsSize = rats.size;
          plagueInitiator = interaction.user.username;

          await startFirstPhasePlague(
            client,
            lastMessageId,
            PlagueFirstPhaseTime
          );

          await updateMessage(client, lastMessageId);

          await sendInteractionReply(
            interaction,
            `You have successfully initiated plague with target @${target.user.username}. Wait for the rats to join.`
          );
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }

    if (interaction.customId === "JoinPlague") {
      const userId = interaction.user.id;
      if (!selectedPlagueTargets[userId]) {
        await sendInteractionReply(interaction, "No member selected");
        return;
      }

      if (
        Object.keys(plagueParticipants).findIndex((key) => key === userId) > -1
      ) {
        await sendInteractionReply(
          interaction,
          "You've already joined plague."
        );
        return;
      }

      const target = selectedPlagueTargets[userId];
      plagueParticipants[userId] = {
        targetId: target.user.id,
        roles: target.roles.cache,
      };

      await updateMessage(client, lastMessageId);

      await sendInteractionReply(
        interaction,
        `You have joined the plague with target @${target.user.username}.`
      );
    }
  });

  eventEmitter.on("NotifyRatChannel", async (msg) => {
    try {
      let channel = await client.channels.fetch(process.env.CHANNELIDRAT);
      const message = await channel.send({
        content: msg,
      });
      setTimeout(async () => {
        await message.delete().catch(console.error);
      }, RoleChangeMessageDisplayTime);
    } catch (err) {
      throw err;
    }
  });
}

async function startFirstPhasePlague(client, lastMessageId, timeout) {
  plagueActive = true;
  setTimeout(async () => {
    await handleFirstPhasePlagueEnd(client, lastMessageId);
  }, timeout);
}

async function handleFirstPhasePlagueEnd(client, lastMessageId) {
  if (Object.keys(plagueParticipants).length > PLAGUETHREADSHOLD) {
    const msg = `The initial phase of plague initiated by @${plagueInitiator} is succeeded, moving to the next phase`;
    eventEmitter.emit("NotifyRatChannel", msg);
    await startSecondPhasePlauge(client, lastMessageId, PlagueSecondPhaseTime);
  } else {
    const msg = `The plague initiated by @${plagueInitiator} is failed, resetting the poll.`;
    eventEmitter.emit("NotifyRatChannel", msg);
    await resetComponents(client, lastMessageId);
  }
}

async function startSecondPhasePlauge(client, lastMessageId, timeout) {
  secondPhase = true;

  plagueTimeout = setTimeout(async () => {
    await handleSecondPhasePlagueEnd(client, lastMessageId);
  }, timeout);
}

async function handleSecondPhasePlagueEnd(client, lastMessageId) {
  const refinedTargets = {};
  Object.keys(plagueParticipants).forEach((userId) => {
    const targetId = plagueParticipants[userId].targetId;
    let targetedNumber = 1;
    Object.keys(plagueParticipants).forEach((otherUserId) => {
      const otherTargetId = plagueParticipants[otherUserId].targetId;
      if (userId !== otherUserId && targetId === otherTargetId)
        targetedNumber++;
    });
    refinedTargets[targetId] = {
      targetedNumber,
      roles: plagueParticipants[userId].roles,
    };
  });
  Object.keys(refinedTargets).forEach(async (targetId) => {
    let killTarget = false;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_SUBHUMAN) &&
      refinedTargets[targetId].targetedNumber > PlagueKillSubhuman
    )
      killTarget = true;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_PEASANT) &&
      refinedTargets[targetId].targetedNumber > PlagueKillPeasant
    )
      killTarget = true;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_SCHOLAR) &&
      refinedTargets[targetId].targetedNumber > PlagueKillScholar
    )
      killTarget = true;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_MERCHANT) &&
      refinedTargets[targetId].targetedNumber > PlagueKillMerchant
    )
      killTarget = true;
    if (
      refinedTargets[targetId].roles.has(process.env.ROLEID_KNIGHT) &&
      refinedTargets[targetId].targetedNumber > PlagueKillKnight
    )
      killTarget = true;

    if (killTarget) {
      const guild = await client.guilds.fetch(process.env.GUILDID);
      const target = await guild.members.fetch(targetId);
      eventEmitter.emit("changeRole", target, "Poop");
      eventEmitter.emit(
        "NotifyRatChannel",
        `@${target.user.username} has been killed of plague.`
      );
    }
  });
  eventEmitter.emit("NotifyRatChannel", `Plague finished.`);
  await resetComponents(client, lastMessageId);
}

async function ceasePlague(client, lastMessageId) {
  if (plagueTimeout) {
    clearTimeout(plagueTimeout);
    eventEmitter.emit(
      "NotifyRatChannel",
      "Plague failed because of insufficient number of rats."
    );
    await resetComponents(client, lastMessageId);
  }
}

async function updateMessage(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDRAT);
    const messageToEdit = await channel.messages.fetch(lastMessageId);

    if (plagueActive) {
      const actionRow_0 = new ActionRowBuilder().addComponents(
        await buildSelectMenu(
          client,
          ["maggot", "cockroach"],
          "SelectNibbleUser"
        )
      );
      const actionRow_1 = new ActionRowBuilder().addComponents(
        await buildSelectMenu(
          client,
          ["subhuman", "peasant", "scholar", "merchant", "knight"],
          "SelectPlagueTarget"
        )
      );
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("Nibble")
          .setLabel("Nibble")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("JoinPlague")
          .setLabel("Join plage with selected target")
          .setStyle(ButtonStyle.Danger)
      );

      let content =
        initContent +
        `\n\n@${plagueInitiator} initiated a plague. Join plague with selected target. (Joined ${
          Object.keys(plagueParticipants).length
        } / ${ratsSize} rats.)`;
      if (secondPhase)
        content =
          initContent +
          `\n\nPlague initiated by @${plagueInitiator} is in the next phase. Join plague with selected target. (Joined ${
            Object.keys(plagueParticipants).length
          } / ${ratsSize} rats.)`;

      await messageToEdit.edit({
        content,
        components: [actionRow_0, actionRow_1, btnRow],
      });
    } else {
      const actionRow_0 = new ActionRowBuilder().addComponents(
        await buildSelectMenu(
          client,
          ["maggot", "cockroach"],
          "SelectNibbleUser"
        )
      );
      const actionRow_1 = new ActionRowBuilder().addComponents(
        await buildSelectMenu(
          client,
          ["subhuman", "peasant", "scholar", "merchant", "knight"],
          "SelectPlagueTarget"
        )
      );
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("Nibble")
          .setLabel("Nibble")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("Plague")
          .setLabel("Plague")
          .setStyle(ButtonStyle.Danger)
      );

      await messageToEdit.edit({
        content: initContent,
        components: [actionRow_0, actionRow_1, btnRow],
      });
    }
  } catch (err) {
    showErrorMsg(err);
  }
}

async function messageRatCommands(client) {
  let channel = null;
  try {
    channel = await client.channels.fetch(process.env.CHANNELIDRAT);
    const selectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(client, ["maggot", "cockroach"], "SelectNibbleUser")
    );

    const plagueSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["subhuman", "peasant", "scholar", "merchant", "knight"],
        "SelectPlagueTarget"
      )
    );

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("Nibble")
        .setLabel("Nibble")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("Plague")
        .setLabel("Plague")
        .setStyle(ButtonStyle.Danger)
    );

    return await channel.send({
      content: initContent,
      components: [selectMenu, plagueSelectMenu, btnRow],
    });
  } catch (err) {
    return console.error(err);
  }
}

async function resetComponents(client, lastMessageId) {
  try {
    selectedTargets = {};
    plagueParticipants = {};
    selectedPlagueTargets = {};
    plagueInitiator = null;
    plagueActive = false;
    secondPhase = false;
    await updateMessage(client, lastMessageId);
  } catch (err) {
    throw err;
  }
}

module.exports = { setupRatBotEvents, messageRatCommands };
