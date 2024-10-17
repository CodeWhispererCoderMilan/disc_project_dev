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
  NobleLordElectionTime,
  LordKingElectionTime,
  NobleLordElectionSuccessThreadshold,
  LordKingElectionSuccessThreadshold,
  LordElectionCoolDown,
  RoleChangeMessageDisplayTime,
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedElectionCandidates = {};
let lords = [];
let lordsSize = 1;
let electionInitiatorId = null;
let electionInitiator = null;
let electionCandidateId = null;
let electionCandidate = null;
let electionActive = false;
let electionParticipants = new Set();
let electionTimeout;
let electionType = "";

const initContent =
  "Lords can trigger a timed poll to upgrade a target of their role by selecting noble or lord in a menu and clicking a button. If over 50% of participants join before the timer ends, the noble role is changed to LORD and if over 60% of participants join before the timer ends, the lord role is changed to KING; otherwise, the attempt fails. A global cooldown is activated after each use.\n\n" +
  "**Abilities:**\n" +
  "- **Elect Lord**: With more than 50% of lords, you can make one noble to lord.\n" +
  "- **Elect King**: With more than 60% of lords, you can make one lord to king.";

function showErrorMsg(err) {
  console.error("ERROR: lord_commands.js", err);
}

async function setupLordBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const hadRoleBeforeNoble = oldMember.roles.cache.has(
      process.env.ROLEID_NOBLE
    );
    const hasRoleNowNoble = newMember.roles.cache.has(process.env.ROLEID_NOBLE);
    const hadRoleBeforeLord = oldMember.roles.cache.has(
      process.env.ROLEID_LORD
    );
    const hasRoleNowLord = newMember.roles.cache.has(process.env.ROLEID_LORD);

    if (electionActive && hadRoleBeforeLord) {
      if (electionParticipants.has(newMember.id)) {
        try {
          selectedElectionCandidates[newMember.id] = null;
          electionParticipants.delete(newMember.id);
          const guild = await client.guilds.fetch(process.env.GUILDID);
          lords = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_LORD)
          );
          lordsSize = lords.size;

          const participationRate = electionParticipants.size / lordsSize;

          if (newMember.id === electionInitiatorId) {
            const msg = `The initiator ${electionInitiator} is no longer a lord.`;
            eventEmitter.emit("NotifyLordChannel", msg);
            electionActive = false;
            await ceaseElection(client, lastMessageId);
            return;
          } else if (
            electionType === "Noble" &&
            participationRate >= NobleLordElectionSuccessThreadshold
          ) {
            ceaseElection(client, lastMessageId);
            return;
          } else if (
            electionType === "Lord" &&
            participationRate >= LordKingElectionSuccessThreadshold
          ) {
            ceaseElection(client, lastMessageId);
            return;
          } else {
            await updateMessage(client, lastMessageId);
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (electionActive && (hadRoleBeforeNoble || hadRoleBeforeLord)) {
      if (newMember.id === electionCandidateId) {
        try {
          const msg = `The role of the candidate @${electionCandidate} has been changed.`;
          eventEmitter.emit("NotifyLordChannel", msg);
          electionActive = false;
          await ceaseElection(client, lastMessageId);
          return;
        } catch (e) {
          showErrorMsg(e);
        }
      }
    }
    if (electionActive && (hadRoleBeforeLord || hasRoleNowLord)) {
      try {
        const guild = await client.guilds.fetch(process.env.GUILDID);
        lords = guild.members.cache.filter((member) =>
          member.roles.cache.has(process.env.ROLEID_LORD)
        );
        lordsSize = lords.size;
        const participationRate = electionParticipants.size / lordsSize;
        if (
          electionType === "Noble" &&
          participationRate >= NobleLordElectionSuccessThreadshold
        ) {
          ceaseElection(client, lastMessageId);
        } else if (
          electionType === "Lord" &&
          participationRate >= LordKingElectionSuccessThreadshold
        ) {
          ceaseElection(client, lastMessageId);
        } else {
          updateMessage(client, lastMessageId);
        }
      } catch (e) {
        showErrorMsg(e);
      }
    }
    if (
      !electionActive &&
      (hadRoleBeforeNoble ||
        hasRoleNowNoble ||
        hadRoleBeforeLord ||
        hasRoleNowLord)
    ) {
      if (lastMessageId) {
        try {
          await updateMessage(client, lastMessageId);
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    if (interaction.customId === "ElectionSelectMenu") {
      const userId = interaction.user.id;
      let candidateId = interaction.values[0];
      try {
        selectedElectionCandidates[userId] =
          await interaction.guild.members.cache.get(candidateId);
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "Election") {
      const userId = interaction.user.id;
      lords = interaction.guild.members.cache.filter((member) =>
        member.roles.cache.has(process.env.ROLEID_LORD)
      );
      lordsSize = lords.size;

      if (!selectedElectionCandidates[userId]) {
        await sendInteractionReply(interaction, "No member selected");
        return;
      }

      let cooldown;
      try {
        cooldown = await CacheGetCooldown("Election", userId);
      } catch (err) {
        showErrorMsg(err);
      }
      if (cooldown) {
        sendInteractionReply(interaction, "Election is on cooldown");
        return;
      }

      electionInitiatorId = userId;
      electionInitiator = interaction.user.username;
      electionParticipants.add(userId);
      electionActive = true;
      electionCandidate = selectedElectionCandidates[userId].user.username;
      electionCandidateId = selectedElectionCandidates[userId].user.id;
      if (
        selectedElectionCandidates[userId].roles.cache.has(
          process.env.ROLEID_NOBLE
        )
      )
        electionType = "Noble";
      else electionType = "Lord";

      if (electionCandidateId === userId) {
        sendInteractionReply(interaction, "You cannot elect yourself.");
        return;
      }

      if (lastMessageId) {
        try {
          // Set cooldown
          await CacheSetCooldown("Election", userId, LordElectionCoolDown);
          await updateMessage(client, lastMessageId);
          if (electionType === "Noble")
            await startElection(client, lastMessageId, NobleLordElectionTime);
          else await startElection(client, lastMessageId, LordKingElectionTime);

          await sendInteractionReply(
            interaction,
            "Election started, waiting for other lords to join."
          );

          const participationRate = electionParticipants.size / lordsSize;
          if (
            electionType === "Noble" &&
            participationRate >= NobleLordElectionSuccessThreadshold
          ) {
            ceaseElection(client, lastMessageId);
            return;
          } else if (
            electionType === "Lord" &&
            participationRate >= LordKingElectionSuccessThreadshold
          ) {
            ceaseElection(client, lastMessageId);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (interaction.customId === "Vote") {
      try {
        if (!electionActive) {
          await sendInteractionReply(
            interaction,
            "There is no active election to join."
          );
          return;
        }

        const userId = interaction.user.id;
        if (userId === electionInitiatorId) {
          await sendInteractionReply(
            interaction,
            "Once you started election, you don't need to vote since you are alreday a participant."
          );
          return;
        }

        if (userId === electionCandidateId) {
          await sendInteractionReply(interaction, "You cannot vote yourself.");
          return;
        }

        if (electionParticipants.has(userId)) {
          await sendInteractionReply(interaction, "You've already voted.");
          return;
        }

        electionParticipants.add(userId);
        await sendInteractionReply(interaction, "You have joind the poll.");

        const participationRate = electionParticipants.size / lordsSize;
        if (electionActive) {
          if (
            (electionType === "Noble" &&
              participationRate >= NobleLordElectionSuccessThreadshold) ||
            (electionType === "Lord" &&
              participationRate >= LordKingElectionSuccessThreadshold)
          ) {
            //If poll succeeded within voting ending time.
            ceaseElection(client, lastMessageId);
            return;
          } else {
            updateMessage(client, lastMessageId);
          }
        }
      } catch (err) {
        throw err;
      }
    }
  });
  eventEmitter.on("NotifyLordChannel", async (msg) => {
    try {
      let channel = await client.channels.fetch(process.env.CHANNELIDLORD);
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

async function startElection(client, lastMessageId, timeout) {
  electionTimeout = setTimeout(async () => {
    await handleElectionEnd(client, lastMessageId);
  }, timeout);
}

async function handleElectionEnd(client, lastMessageId) {
  const participationRate = electionParticipants.size / lordsSize;
  if (
    electionActive &&
    ((electionType === "Noble" &&
      participationRate >= NobleLordElectionSuccessThreadshold) ||
      (electionType === "Lord" &&
        participationRate >= LordKingElectionSuccessThreadshold))
  ) {
    let msg = "";
    const target = selectedElectionCandidates[electionInitiatorId];
    if (target) {
      if (electionType === "Noble") {
        eventEmitter.emit("changeRole", target, "Lord");
        msg = `Election successful! @${electionCandidate} has become a lord by @${electionInitiator}.`;
      }
      if (electionType === "Lord") {
        eventEmitter.emit("changeRole", target, "King");
        msg = `Election successful! @${electionCandidate} has become a king by @${electionInitiator}.`;
      }
    }
    eventEmitter.emit("NotifyLordChannel", msg);
  } else {
    const msg = `Election on @${electionCandidate} started by @${electionInitiator} has been failed.`;
    eventEmitter.emit("NotifyLordChannel", msg);
  }
  await resetComponents(client, lastMessageId);
}

async function ceaseElection(client, lastMessageId) {
  if (electionTimeout) {
    clearTimeout(electionTimeout);
    await handleElectionEnd(client, lastMessageId);
  }
}

async function updateMessage(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
    const messageToEdit = await channel.messages.fetch(lastMessageId);

    if (!electionActive) {
      const electionSelectMenu = await buildSelectMenu(
        client,
        ["noble", "lord"],
        "ElectionSelectMenu"
      );
      const actionRow_0 = new ActionRowBuilder().addComponents(
        electionSelectMenu
      );
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("Election")
          .setLabel("Election")
          .setStyle(ButtonStyle.Primary)
      );

      await messageToEdit.edit({
        content: initContent,
        components: [actionRow_0, buttonRow],
      });
    } else {
      const actionRow_0 = ActionRowBuilder.from(
        messageToEdit.components[0].toJSON()
      );
      const electionSelectMenu = StringSelectMenuBuilder.from(
        actionRow_0.components[0].toJSON()
      )
        .setDisabled(true)
        .setPlaceholder(electionCandidate);
      actionRow_0.components[0] = electionSelectMenu;

      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("Vote")
          .setLabel("Vote")
          .setStyle(ButtonStyle.Primary)
      );

      await messageToEdit.edit({
        content:
          initContent +
          `\n@${electionInitiator} started election. Let's vote for ${electionType} @${electionCandidate}. (Joined ${electionParticipants.size} / ${lordsSize}.)`,
        components: [actionRow_0, buttonRow],
      });
    }
  } catch (err) {
    showErrorMsg(err);
  }
}

async function messageLordCommands(client) {
  let channel = null;
  try {
    channel = await client.channels.fetch(process.env.CHANNELIDLORD);
  } catch (err) {
    showErrorMsg(err);
    return;
  }

  try {
    const electionSelectMenu = await buildSelectMenu(
      client,
      ["noble", "lord"],
      "ElectionSelectMenu"
    );
    const actionRow_0 = new ActionRowBuilder().addComponents(
      electionSelectMenu
    );
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("Election")
        .setLabel("Election")
        .setStyle(ButtonStyle.Primary)
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
    selectedElectionCandidates = {};
    electionActive = false;
    electionInitiator = null;
    electionInitiatorId = null;
    electionCandidate = null;
    electionCandidateId = null;
    electionParticipants.clear();
    lordsSize = 1;
    lords = [];
    electionType = "";
    await updateMessage(client, lastMessageId);
  } catch (err) {
    throw err;
  }
}

module.exports = { setupLordBotEvents, messageLordCommands };
