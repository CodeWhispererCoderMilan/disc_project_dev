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
  PlagueFirstPollTimeLimit,
  PlagueSecondPollTimeLimit,
  PlagueKillSubhuman,
  PlagueKillPeasant,
  PlagueKillScholar,
  PlagueKillMerchant,
  PlagueKillKnight,
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
const THREADSHOLD = 10;

let selectedTargets = {};
let plagueParticipants = {};
let selectedPlagueTargets = {};
let plagueInitiator = "";
let pollTimeout;
let pollActive = false;
let secondPhase = false;

async function setupRatBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const hadRoleBeforeRat = oldMember.roles.cache.has(process.env.ROLEID_RAT);
    const hasRoleNowRat = newMember.roles.cache.has(process.env.ROLEID_PEASANT);
    if (pollActive && hadRoleBeforeRat && !hasRoleNowRat) {
      if (
        Object.keys(plagueParticipants).findIndex(
          (key) => key === newMember.id
        ) > -1
      ) {
        delete plagueParticipants[newMember.id];

        const channel = await client.channels.fetch(process.env.CHANNELIDRAT);
        const messageToEdit = await channel.messages.fetch(lastMessageId);
        let content =
          initContent +
          `\n\n@${plagueInitiator} initiated a plague. Join plague with selected target. (Joined ${
            Object.keys(plagueParticipants).length
          } rats.)`;

        if (secondPhase) {
          if (Object.keys(plagueParticipants).length <= THREADSHOLD) {
            triggerPollEarly(client, messageToEdit);
            return;
          }
          content =
            initContent +
            `\n\nPlague initiated by @${plagueInitiator} is in the next phase. Join plague with selected target. (Joined ${
              Object.keys(plagueParticipants).length
            } rats.)`;
        }
        await messageToEdit.edit({
          content,
        });
      }
    }

    if (
      oldMember.roles.cache.has(process.env.ROLEID_MAGGOT) ||
      oldMember.roles.cache.has(process.env.ROLEID_COCKROACH)
    ) {
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
    if (
      oldMember.roles.cache.has(process.env.ROLEID_COCKROACH) ||
      oldMember.roles.cache.has(process.env.ROLEID_MAGGOT) ||
      oldMember.roles.cache.has(process.env.ROLEID_SUBHUMAN) ||
      oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
      oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
      oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
      oldMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
      newMember.roles.cache.has(process.env.ROLEID_COCKROACH) ||
      newMember.roles.cache.has(process.env.ROLEID_MAGGOT) ||
      newMember.roles.cache.has(process.env.ROLEID_SUBHUMAN) ||
      newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
      newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
      newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
      newMember.roles.cache.has(process.env.ROLEID_KNIGHT)
    ) {
      await updateSelectMenu(client, lastMessageId);
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

    if (interaction.customId === "SelectPlagueUser") {
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

          const channel = await client.channels.fetch(process.env.CHANNELIDRAT);
          const messageToEdit = await channel.messages.fetch(lastMessageId);
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );
          const actionRow_1 = ActionRowBuilder.from(
            messageToEdit.components[1].toJSON()
          );
          const btnRow = ActionRowBuilder.from(
            messageToEdit.components[2].toJSON()
          );
          const plagueBtn = ButtonBuilder.from(btnRow.components[1].toJSON());
          plagueBtn.setDisabled(true);
          const joinPlagueButton = new ButtonBuilder()
            .setCustomId("JoinPlague")
            .setLabel("Join plage with selected target")
            .setStyle(ButtonStyle.Danger);
          btnRow.components[1] = plagueBtn;
          btnRow.components[2] = joinPlagueButton;

          plagueInitiator = interaction.user.username;

          const content =
            initContent +
            `\n\n@${plagueInitiator} initiated a plague. Join plague with selected target. (Joined ${
              Object.keys(plagueParticipants).length
            } rats.)`;
          await messageToEdit.edit({
            content,
            components: [actionRow_0, actionRow_1, btnRow],
          });

          startFirstPoll(client, messageToEdit, PlagueFirstPollTimeLimit);

          await sendInteractionReply(
            interaction,
            "You have successfully initiated plague. Wait for the rats to join."
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

      const channel = await client.channels.fetch(process.env.CHANNELIDRAT);
      const messageToEdit = await channel.messages.fetch(lastMessageId);
      let content =
        initContent +
        `\n\n@${plagueInitiator} initiated a plague. Join plague with selected target. (Joined ${
          Object.keys(plagueParticipants).length
        } rats.)`;
      if (secondPhase)
        content =
          initContent +
          `\n\nPlague initiated by @${plagueInitiator} is in the next phase. Join plague with selected target. (Joined ${
            Object.keys(plagueParticipants).length
          } rats.)`;

      await messageToEdit.edit({
        content,
      });

      await sendInteractionReply(interaction, "You have joined the plague.");
    }
  });

  eventEmitter.on("notifyChannel", async (message) => {
    try {
      const channel = await client.channels.fetch(process.env.CHANNELIDRAT);
      const tempMessage = await channel.send(message);

      // Delete the message after 30 seconds
      setTimeout(() => {
        tempMessage.delete().catch(console.error);
      }, 30000);
    } catch (err) {
      throw err;
    }
  });
}

async function startFirstPoll(client, messageToEdit, timeout) {
  pollActive = true;
  setTimeout(async () => {
    await handleFirstPollEnd(client, messageToEdit);
  }, timeout);
}

async function handleFirstPollEnd(client, messageToEdit) {
  if (Object.keys(plagueParticipants).length > THREADSHOLD) {
    const msg = `The initial phase of plague initiated by @${plagueInitiator} is succeeded, moving to the next phase`;
    eventEmitter.emit("notifyChannel", msg);
    startSecondPoll(client, messageToEdit, PlagueSecondPollTimeLimit);
  } else {
    const msg = `The plague initiated by @${plagueInitiator} is failed, resetting the poll.`;
    eventEmitter.emit("notifyChannel", msg);
    await resetComponents(client, messageToEdit);
  }
}

async function startSecondPoll(client, messageToEdit, timeout) {
  secondPhase = true;
  const content =
    initContent +
    `\n\nPlague initiated by @${plagueInitiator} is in the next phase. Join plague with selected target. (Joined ${
      Object.keys(plagueParticipants).length
    } rats.)`;
  await messageToEdit.edit({
    content,
  });
  pollTimeout = setTimeout(async () => {
    await handleSecondPollEnd(client, messageToEdit);
  }, timeout);
}

async function handleSecondPollEnd(client, messageToEdit) {
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

    console.log("REFINED", refinedTargets);
    console.log("KillTARGET", killTarget);

    if (killTarget) {
      const guild = await client.guilds.fetch(process.env.GUILDID);
      const target = await guild.members.fetch(targetId);
      eventEmitter.emit("changeRole", target, "Poop");
      eventEmitter.emit(
        "notifyChannel",
        `@${target.user.username} has been killed of plague.`
      );
    }
  });
  resetComponents(client, messageToEdit);
}

// Function to trigger the poll early
async function triggerPollEarly(client, messageToEdit) {
  if (pollTimeout) {
    clearTimeout(pollTimeout); // Clear the original timeout
    eventEmitter.emit(
      "notifyChannel",
      "Plague failed because of insufficient number of rats."
    );
    await resetComponents(client, messageToEdit);
  }
}

async function updateSelectMenu(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDRAT);
    const messageToEdit = await channel.messages.fetch(lastMessageId);
    const selectMenu = await buildSelectMenu(
      client,
      ["maggot", "cockroach"],
      "SelectNibbleUser"
    );
    const actionRow_0 = new ActionRowBuilder().addComponents(selectMenu);
    const actionRow_1 = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["subhuman", "peasant", "scholar", "merchant", "knight"],
        "SelectPlagueUser"
      )
    );
    const existingComponents = messageToEdit.components.map((component) =>
      ActionRowBuilder.from(component.toJSON())
    );
    existingComponents[0] = actionRow_0;
    existingComponents[1] = actionRow_1;

    await messageToEdit.edit({
      content: messageToEdit.content,
      components: existingComponents,
    });
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
        "SelectPlagueUser"
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

async function resetComponents(client, messageToEdit) {
  try {
    selectedTargets = {};
    plagueParticipants = {};
    selectedPlagueTargets = {};
    plagueInitiator = "";
    pollActive = false;
    secondPhase = false;

    const actionRow_0 = ActionRowBuilder.from(
      messageToEdit.components[0].toJSON()
    );
    const actionRow_1 = ActionRowBuilder.from(
      messageToEdit.components[1].toJSON()
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
  } catch (err) {
    throw err;
  }
}

module.exports = { setupRatBotEvents, messageRatCommands };
