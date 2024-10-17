const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  buildSelectMenu,
  sendInteractionReply,
} = require("../functions/botActions");
const {
  CacheGetCooldown,
  CacheSetCooldown,
} = require("../apis/redis/redisCache");
const {
  MobFlayingTime,
  MobFlayingSuccessThreadshold,
  MobFlayingCoolDown,
  RoleChangeMessageDisplayTime,
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedTargets = {};
let peasants = [];
let peasantsSize = 1;
let mobFlayingInitiatorId = null;
let mobFlayingInitiator = null;
let mobFlayingTargetId = null;
let mobFlayingTarget = null;
let mobFlayingActive = false;
let mobFlayingParticipants = new Set();
let mobFlayingTimeout;

const initContent =
  "Peasants can trigger a timed poll to strip a target of their role by selecting SUBHUMAN or PEASANT in a menu and clicking a button. If over 50% of participants join before the timer ends, the target's role is changed to POOP; otherwise, the attempt fails. A global cooldown is activated after each use.\n\n" +
  "**Abilities:**\n" +
  "- **Mob Flaying**: With more than 50% of peasants, you can make one sub-human or peasant to poop.";

function showErrorMsg(err) {
  console.error("ERROR: peasant_commands.js", err);
}

async function setupPeasantBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const hadRoleBeforeSubHuman = oldMember.roles.cache.has(
      process.env.ROLEID_SUBHUMAN
    );
    const hasRoleNowSubhuman = newMember.roles.cache.has(
      process.env.ROLEID_SUBHUMAN
    );
    const hadRoleBeforePeasant = oldMember.roles.cache.has(
      process.env.ROLEID_PEASANT
    );
    const hasRoleNowPeasant = newMember.roles.cache.has(
      process.env.ROLEID_PEASANT
    );

    if (mobFlayingActive && hadRoleBeforePeasant) {
      if (mobFlayingParticipants.has(newMember.id)) {
        try {
          selectedTargets[newMember.id] = null;
          mobFlayingParticipants.delete(newMember.id);
          const guild = await client.guilds.fetch(process.env.GUILDID);
          peasants = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_PEASANT)
          );
          peasantsSize = peasants.size;

          const participationRate = mobFlayingParticipants.size / peasantsSize;

          if (newMember.id === mobFlayingInitiatorId) {
            const msg = `The initiator ${mobFlayingInitiator} is no longer a peasant.`;
            eventEmitter.emit("NotifyPeasantChannel", msg);
            mobFlayingActive = false;
            await ceaseMobFlaying(client, lastMessageId);
            return;
          } else if (participationRate >= MobFlayingSuccessThreadshold) {
            await ceaseMobFlaying(client, lastMessageId);
          } else {
            await updateMessage(client, lastMessageId);
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (mobFlayingActive && (hadRoleBeforePeasant || hadRoleBeforeSubHuman)) {
      if (newMember.id === mobFlayingTargetId) {
        try {
          const msg = `The role of the target @${mobFlayingTarget} has been changed.`;
          eventEmitter.emit("NotifyPeasantChannel", msg);
          mobFlayingActive = false;
          await ceaseMobFlaying(client, lastMessageId);
        } catch (e) {
          showErrorMsg(e);
        }
      }
    }
    if (
      hadRoleBeforePeasant ||
      hasRoleNowPeasant ||
      hadRoleBeforeSubHuman ||
      hasRoleNowSubhuman
    ) {
      if (lastMessageId) {
        try {
          const guild = await client.guilds.fetch(process.env.GUILDID);
          peasants = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_PEASANT)
          );
          peasantsSize = peasants.size;
          await updateMessage(client, lastMessageId);
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    if (interaction.customId === "MobFlayingSelectMenu") {
      const userId = interaction.user.id;
      let targetId = interaction.values[0];
      try {
        selectedTargets[userId] = await interaction.guild.members.cache.get(
          targetId
        );
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "MobFlaying") {
      const userId = interaction.user.id;
      peasants = interaction.guild.members.cache.filter((member) =>
        member.roles.cache.has(process.env.ROLEID_PEASANT)
      );
      peasantsSize = peasants.size;

      if (!selectedTargets[userId]) {
        await sendInteractionReply(interaction, "No member selected");
        return;
      }

      let cooldown;
      try {
        cooldown = await CacheGetCooldown("MobFlaying", userId);
      } catch (err) {
        showErrorMsg(err);
      }
      if (cooldown) {
        await sendInteractionReply(interaction, "Mob flaying is on cooldown");
        return;
      }

      mobFlayingInitiatorId = userId;
      mobFlayingInitiator = interaction.user.username;
      mobFlayingParticipants.add(userId);
      mobFlayingActive = true;
      mobFlayingTarget = selectedTargets[userId].user.username;
      mobFlayingTargetId = selectedTargets[userId].user.id;

      if (mobFlayingTargetId === userId) {
        await sendInteractionReply(interaction, "You cannot target yourself.");
        return;
      }

      if (lastMessageId) {
        try {
          // Set cooldown
          await CacheSetCooldown("MobFlaying", userId, MobFlayingCoolDown);
          await updateMessage(client, lastMessageId);
          await startMobFlaying(client, lastMessageId, MobFlayingTime);

          await sendInteractionReply(
            interaction,
            "Mob flaying initiated, waiting for other peasants to join."
          );

          const participationRate = mobFlayingParticipants.size / peasantsSize;
          if (participationRate >= MobFlayingSuccessThreadshold) {
            ceaseMobFlaying(client, lastMessageId);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (interaction.customId === "JoinMobFlaying") {
      try {
        if (!mobFlayingActive) {
          await sendInteractionReply(
            interaction,
            "There is no active mob flaying to join."
          );
          return;
        }

        const userId = interaction.user.id;
        if (userId === mobFlayingInitiatorId) {
          await sendInteractionReply(
            interaction,
            "Once you initiated mob flaying, you don't need to join since you are alreday a participant."
          );
          return;
        }

        if (userId === mobFlayingTargetId) {
          await sendInteractionReply(
            interaction,
            "You cannot join mob flyaing targeted yourself."
          );
          return;
        }

        if (mobFlayingParticipants.has(userId)) {
          await sendInteractionReply(interaction, "You've already joined.");
          return;
        }

        mobFlayingParticipants.add(userId);
        await sendInteractionReply(
          interaction,
          "You have joind the mob flaying."
        );

        const participationRate = mobFlayingParticipants.size / peasantsSize;
        if (
          mobFlayingActive &&
          participationRate >= MobFlayingSuccessThreadshold
        ) {
          //If poll succeeded within voting ending time.
          ceaseMobFlaying(client, lastMessageId);
          return;
        } else {
          updateMessage(client, lastMessageId);
        }
      } catch (err) {
        throw err;
      }
    }
  });
  eventEmitter.on("NotifyPeasantChannel", async (msg) => {
    try {
      let channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
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

async function startMobFlaying(client, lastMessageId, timeout) {
  mobFlayingTimeout = setTimeout(async () => {
    await handleMobFlayingEnd(client, lastMessageId);
  }, timeout);
}

async function handleMobFlayingEnd(client, lastMessageId) {
  const participationRate = mobFlayingParticipants.size / peasantsSize;
  if (mobFlayingActive && participationRate >= MobFlayingSuccessThreadshold) {
    const target = selectedTargets[mobFlayingInitiatorId];
    if (target) eventEmitter.emit("changeRole", target, "Poop");
    const msg = `Mob flaying successful! @${mobFlayingTarget} has become a poop by @${mobFlayingInitiator}.`;
    eventEmitter.emit("NotifyPeasantChannel", msg);
  } else {
    const msg = `Mob flaying on @${mobFlayingTarget} initiated by @${mobFlayingInitiator} has been failed.`;
    eventEmitter.emit("NotifyPeasantChannel", msg);
  }
  await resetComponents(client, lastMessageId);
}

async function ceaseMobFlaying(client, lastMessageId) {
  if (mobFlayingTimeout) {
    clearTimeout(mobFlayingTimeout);
    await handleMobFlayingEnd(client, lastMessageId);
  }
}

async function updateMessage(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
    const messageToEdit = await channel.messages.fetch(lastMessageId);

    if (!mobFlayingActive) {
      const mobFlayingSelectMenu = await buildSelectMenu(
        client,
        ["peasant", "subhuman"],
        "MobFlayingSelectMenu"
      );
      const actionRow_0 = new ActionRowBuilder().addComponents(
        mobFlayingSelectMenu
      );
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("MobFlaying")
          .setLabel("Mob Flaying")
          .setStyle(ButtonStyle.Danger)
      );

      await messageToEdit.edit({
        content: initContent,
        components: [actionRow_0, buttonRow],
      });
    } else {
      const actionRow_0 = ActionRowBuilder.from(
        messageToEdit.components[0].toJSON()
      );
      const mobFlayingSelectMenu = StringSelectMenuBuilder.from(
        actionRow_0.components[0].toJSON()
      )
        .setDisabled(true)
        .setPlaceholder(mobFlayingTarget);
      actionRow_0.components[0] = mobFlayingSelectMenu;

      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("JoinMobFlaying")
          .setLabel("Join Mob Flaying")
          .setStyle(ButtonStyle.Primary)
      );

      await messageToEdit.edit({
        content:
          initContent +
          `\n@${mobFlayingInitiator} initiated a mob flaying. Join to downgrade ${mobFlayingTarget}. (Joined ${mobFlayingParticipants.size} / ${peasantsSize}.)`,
        components: [actionRow_0, buttonRow],
      });
    }
  } catch (err) {
    showErrorMsg(err);
  }
}

async function messagePeasantCommands(client) {
  let channel = null;
  try {
    channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
  } catch (err) {
    showErrorMsg(err);
    return;
  }

  try {
    const mobFlayingSelectMenu = await buildSelectMenu(
      client,
      ["peasant", "subhuman"],
      "MobFlayingSelectMenu"
    );
    const actionRow_0 = new ActionRowBuilder().addComponents(
      mobFlayingSelectMenu
    );
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("MobFlaying")
        .setLabel("Mob Flaying")
        .setStyle(ButtonStyle.Danger)
    );

    const message = await channel.send({
      content: initContent,
      components: [actionRow_0, buttonRow],
    });
    return message;
  } catch (err) {
    showErrorMsg(err);
  }
}

async function resetComponents(client, lastMessageId) {
  try {
    selectedTargets = {};
    mobFlayingActive = false;
    mobFlayingInitiator = null;
    mobFlayingInitiatorId = null;
    mobFlayingTarget = null;
    mobFlayingTargetId = null;
    mobFlayingParticipants.clear();
    peasantsSize = 1;
    peasants = [];
    await updateMessage(client, lastMessageId);
  } catch (err) {
    throw err;
  }
}

module.exports = { setupPeasantBotEvents, messagePeasantCommands };
