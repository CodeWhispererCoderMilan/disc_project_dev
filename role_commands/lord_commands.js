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
  LordNobleTimedPollDuration,
  LordNobleTimedPollWinningRate,
  LordKingTimedPollDuration,
  LordKingTimedPollWinningRate,
  GlobalCoolDown,
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedMembers = {};
let roleMembers = [];
let roleMembersSize = 1;
let pollInitiatorId = null;
let pollInitiatorUsername = null;
let pollTargetName = null;
let pollTargetId = null;
let pollActive = false;
let pollParticipants = new Set();
let eventListenersSetUp = false; // Flag to track if event listeners are set up
let pollTimeout;
let type = "";
let selectType = "";

let interactions = [];

function showErrorMsg(err) {
  console.error("ERROR: lord_commands.js", err);
}

const initContent =
  "Lords can trigger a timed poll to upgrade a target of their role by selecting noble or lord in a menu and clicking a button. If over 50% of participants join before the timer ends, the noble role is changed to LORD and if over 60% of participants join before the timer ends, the lord role is changed to KING; otherwise, the attempt fails. A global cooldown is activated after each use.\n\n" +
  "**Abilities:**\n" +
  "- **Elect Lord**: With more than 50% of lords, you can make one noble to lord.\n" +
  "- **Elect King**: With more than 60% of lords, you can make one lord to king.";

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
    const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
    const messageToEdit = await channel.messages.fetch(lastMessageId);
    if (pollActive && hadRoleBeforeLord && !hasRoleNowLord) {
      if (pollParticipants.has(newMember.id)) {
        try {
          selectedMembers[newMember.id] = null;
          pollParticipants.delete(newMember.id);

          if (newMember.id === pollInitiatorId) {
            // If the initiator lost the role, reset the poll
            await client.emit(
              "TimedPollInitiatorRoleChanged",
              pollInitiatorUsername
            );
            pollActive = false;
            await triggerPollEarly(client, messageToEdit);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (pollActive && hadRoleBeforeNoble && !hasRoleNowNoble) {
      if (newMember.id === pollTargetId) {
        try {
          await client.emit("TimedPollTargetRoleChanged", pollTargetName);
          pollActive = false;
          await triggerPollEarly(client, messageToEdit);
          return;
        } catch (e) {
          showErrorMsg(e);
        }
      }
    }
    if (pollActive && hadRoleBeforeLord && !hasRoleNowLord) {
      if (newMember.id === pollTargetId) {
        try {
          await client.emit("TimedPollTargetRoleChanged", pollTargetName);
          pollActive = false;
          await triggerPollEarly(client, messageToEdit);
          return;
        } catch (e) {
          showErrorMsg(e);
        }
      }
    }
    if (
      hadRoleBeforeNoble ||
      hasRoleNowNoble ||
      hadRoleBeforeLord ||
      hasRoleNowLord
    ) {
      if (lastMessageId) {
        try {
          const guild = await client.guilds.fetch(process.env.GUILDID);
          await guild.members.fetch();
          roleMembers = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_LORD)
          );
          roleMembersSize = roleMembers.size;

          const channel = await client.channels.fetch(
            process.env.CHANNELIDLORD
          );
          const messageToEdit = await channel.messages.fetch(lastMessageId);
          let content = initContent;
          if (pollActive) {
            content =
              content +
              `\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;
            const participationRate = pollParticipants.size / roleMembersSize;
            if (participationRate >= LordNobleTimedPollWinningRate) {
              triggerPollEarly(client, messageToEdit);
              return;
            }
          }
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );
          const actionRow_1 = ActionRowBuilder.from(
            messageToEdit.components[1].toJSON()
          );
          const existingComponents = messageToEdit.components.map((component) =>
            ActionRowBuilder.from(component.toJSON())
          );
          const actionRow_2 = ActionRowBuilder.from(
            messageToEdit.components[2].toJSON()
          );
          if (pollActive) {
            const nobleSelectMenu = StringSelectMenuBuilder.from(
              actionRow_0.components[0].toJSON()
            );
            const lordSelectMenu = StringSelectMenuBuilder.from(
              actionRow_1.components[0].toJSON()
            );
            actionRow_0.components[0] = nobleSelectMenu;
            actionRow_1.components[0] = lordSelectMenu;
            const electNobleButton = ButtonBuilder.from(
              actionRow_2.components[0].toJSON()
            );
            const electKingButton = ButtonBuilder.from(
              actionRow_2.components[1].toJSON()
            );
            electNobleButton.setDisabled(true);
            const joinPollButton = new ButtonBuilder()
              .setCustomId("JoinPoll")
              .setLabel("Join Poll")
              .setStyle(ButtonStyle.Primary);
            actionRow_2.components[0] = electNobleButton;
            actionRow_2.components[1] = electKingButton;
            actionRow_2.components[2] = joinPollButton;
            existingComponents[2] = actionRow_2;
          } else {
            // Reset poll button
            const nobleSelectMenu = await buildSelectMenu(
              client,
              ["noble"],
              "NobleSelectMenu"
            );
            const lordSelectMenu = await buildSelectMenu(
              client,
              ["lord"],
              "LordSelectMenu"
            );
            actionRow_0.components[0] = nobleSelectMenu;
            actionRow_1.components[0] = lordSelectMenu;
            const buttonRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("ElectLord")
                .setLabel("Elect Lord")
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId("ElectKing")
                .setLabel("Elect King")
                .setStyle(ButtonStyle.Danger)
            );
            existingComponents[2] = buttonRow;
          }
          existingComponents[0] = actionRow_0;
          existingComponents[1] = actionRow_1;
          await messageToEdit.edit({
            content,
            components: existingComponents,
          });
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    if (interaction.customId === "NobleSelectMenu") {
      selectType = "noble";
      const userId = interaction.user.id;
      let selectedMemberId = interaction.values[0];
      try {
        selectedMembers[userId] = await interaction.guild.members.cache.get(
          selectedMemberId
        );
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "LordSelectMenu") {
      selectType = "lord";
      const userId = interaction.user.id;
      let selectedMemberId = interaction.values[0];
      try {
        selectedMembers[userId] = await interaction.guild.members.cache.get(
          selectedMemberId
        );
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "ElectLord") {
      type = "noble";
      const userId = interaction.user.id;
      roleMembers = interaction.guild.members.cache.filter((member) =>
        member.roles.cache.has(process.env.ROLEID_LORD)
      );
      roleMembersSize = roleMembers.size;

      let cooldown;
      try {
        cooldown = await CacheGetCooldown("GlobalCooldown", userId);
      } catch (err) {
        showErrorMsg(err);
      }
      if (cooldown) {
        sendInteractionReply(interaction, "Timed poll is on cooldown");
        return;
      }

      if (!selectedMembers[userId]) {
        sendInteractionReply(interaction, "No member selected");
        return;
      }
      if (selectType == "lord") {
        sendInteractionReply(interaction, "You have to select noble");
        return;
      }

      if (selectedMembers[userId].user.id === userId) {
        sendInteractionReply(interaction, "You cannot target yourself.");
        return;
      }

      pollInitiatorId = userId;
      pollInitiatorUsername = interaction.user.username;
      pollParticipants.add(userId);
      pollActive = true;
      pollTargetName = selectedMembers[userId].user.username;
      pollTargetId = selectedMembers[userId].user.id;
      interactions = [];
      interactions.push(interaction);

      const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
      if (lastMessageId) {
        try {
          // Set cooldown
          await CacheSetCooldown("GlobalCooldown", userId, GlobalCoolDown);

          const messageToEdit = await channel.messages.fetch(lastMessageId);
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );
          const actionRow_1 = ActionRowBuilder.from(
            messageToEdit.components[1].toJSON()
          );
          const nobleSelectMenu = StringSelectMenuBuilder.from(
            actionRow_0.components[0].toJSON()
          ).setPlaceholder(selectedMembers[userId].user.username);
          const lordSelectMenu = StringSelectMenuBuilder.from(
            actionRow_1.components[0].toJSON()
          );
          actionRow_0.components[0] = nobleSelectMenu;
          actionRow_1.components[0] = lordSelectMenu;
          const actionRow_2 = ActionRowBuilder.from(
            messageToEdit.components[2].toJSON()
          );
          const electLordButton = ButtonBuilder.from(
            actionRow_2.components[0].toJSON()
          );
          electLordButton.setDisabled(true);
          const electKingButton = ButtonBuilder.from(
            actionRow_2.components[1].toJSON()
          );
          electKingButton.setDisabled(true);
          // pollButton.setDisabled(true);
          const joinPollButton = new ButtonBuilder()
            .setCustomId("JoinPoll")
            .setLabel("Join Poll")
            .setStyle(ButtonStyle.Primary);
          actionRow_2.components[0] = electLordButton;
          actionRow_2.components[1] = electKingButton;
          actionRow_2.components[2] = joinPollButton;

          const content =
            initContent +
            `\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;
          await messageToEdit.edit({
            content,
            components: [actionRow_0, actionRow_1, actionRow_2],
          });

          await startPoll(client, messageToEdit, "noble");

          await sendInteractionReply(
            interaction,
            "Timed poll initiated, waiting for other lords to join your poll"
          );

          const participationRate = pollParticipants.size / roleMembersSize;
          if (participationRate >= LordNobleTimedPollWinningRate) {
            triggerPollEarly(client, messageToEdit);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }

    if (interaction.customId === "ElectKing") {
      type = "king";
      const userId = interaction.user.id;
      roleMembers = interaction.guild.members.cache.filter((member) =>
        member.roles.cache.has(process.env.ROLEID_LORD)
      );
      roleMembersSize = roleMembers.size;

      let cooldown;
      try {
        cooldown = await CacheGetCooldown("GlobalCooldown", userId);
      } catch (err) {
        showErrorMsg(err);
      }
      if (cooldown) {
        sendInteractionReply(interaction, "Timed poll is on cooldown");
        return;
      }

      if (!selectedMembers[userId]) {
        sendInteractionReply(interaction, "No member selected");
        return;
      }
      if (selectType == "noble") {
        sendInteractionReply(interaction, "You have to select lord");
        return;
      }

      if (selectedMembers[userId].user.id === userId) {
        sendInteractionReply(interaction, "You cannot target yourself.");
        return;
      }

      pollInitiatorId = userId;
      pollInitiatorUsername = interaction.user.username;
      pollParticipants.add(userId);
      pollActive = true;
      pollTargetName = selectedMembers[userId].user.username;
      pollTargetId = selectedMembers[userId].user.id;
      interactions = [];
      interactions.push(interaction);

      const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
      if (lastMessageId) {
        try {
          // Set cooldown
          await CacheSetCooldown("GlobalCooldown", userId, GlobalCoolDown);

          const messageToEdit = await channel.messages.fetch(lastMessageId);
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );
          const actionRow_1 = ActionRowBuilder.from(
            messageToEdit.components[1].toJSON()
          );
          const nobleSelectMenu = StringSelectMenuBuilder.from(
            actionRow_0.components[0].toJSON()
          );

          const lordSelectMenu = StringSelectMenuBuilder.from(
            actionRow_1.components[0].toJSON()
          ).setPlaceholder(selectedMembers[userId].user.username);
          actionRow_0.components[0] = nobleSelectMenu;
          actionRow_1.components[0] = lordSelectMenu;
          const actionRow_2 = ActionRowBuilder.from(
            messageToEdit.components[2].toJSON()
          );
          const electLordButton = ButtonBuilder.from(
            actionRow_2.components[0].toJSON()
          );
          electLordButton.setDisabled(true);
          const electKingButton = ButtonBuilder.from(
            actionRow_2.components[1].toJSON()
          );
          electKingButton.setDisabled(true);
          // pollButton.setDisabled(true);
          const joinPollButton = new ButtonBuilder()
            .setCustomId("JoinPoll")
            .setLabel("Join Poll")
            .setStyle(ButtonStyle.Primary);
          actionRow_2.components[0] = electLordButton;
          actionRow_2.components[1] = electKingButton;
          actionRow_2.components[2] = joinPollButton;

          const content =
            initContent +
            `\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;
          await messageToEdit.edit({
            content,
            components: [actionRow_0, actionRow_1, actionRow_2],
          });

          await startPoll(client, messageToEdit, "noble");

          await sendInteractionReply(
            interaction,
            "Timed poll initiated, waiting for other lords to join your poll"
          );

          const participationRate = pollParticipants.size / roleMembersSize;
          if (participationRate >= LordNobleTimedPollWinningRate) {
            triggerPollEarly(client, messageToEdit);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }

    if (interaction.customId === "JoinPoll") {
      try {
        if (!pollActive) {
          await sendInteractionReply(
            interaction,
            "There is no active poll to join."
          );
          return;
        }

        const userId = interaction.user.id;
        if (userId === pollInitiatorId) {
          await sendInteractionReply(
            interaction,
            "Once you created a poll, you don't need to join your poll since you are alreday a participant."
          );
          return;
        }

        if (pollParticipants.has(userId)) {
          await sendInteractionReply(
            interaction,
            "You've already joined this poll."
          );
          return;
        }

        interactions.push(interaction);
        pollParticipants.add(userId);
        await sendInteractionReply(interaction, "You have joind the poll.");

        const participationRate = pollParticipants.size / roleMembersSize;
        const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
        const messageToEdit = await channel.messages.fetch(lastMessageId);
        if (pollActive && participationRate >= LordNobleTimedPollWinningRate) {
          //If poll succeeded within voting ending time.
          triggerPollEarly(client, messageToEdit);
          return;
        } else {
          const editedContent =
            initContent +
            `\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;

          await messageToEdit.edit({ content: editedContent });
        }
      } catch (err) {
        throw err;
      }
    }
  });
  if (!eventListenersSetUp) {
    eventEmitter.on(
      "TimedPollComplete",
      async (targetName, initiatorUsername) => {
        try {
          if (type == "noble") {
            const message =
              "Timed Poll successful! " +
              targetName +
              " has become a lord by " +
              initiatorUsername +
              ".";
            sendMessage(message);
          } else {
            const message =
              "Timed Poll successful! " +
              targetName +
              " has become a king by " +
              initiatorUsername +
              ".";
            sendMessage(message);
          }
        } catch (err) {
          throw err;
        }
      }
    );

    eventEmitter.on(
      "TimedPollFailed",
      async (targetName, initiatorUsername) => {
        try {
          const message =
            "Timed Poll on " +
            targetName +
            " initiated by " +
            initiatorUsername +
            " has been failed.";

          sendMessage(message);
        } catch (err) {
          throw err;
        }
      }
    );

    client.on("TimedPollInitiatorRoleChanged", async (username) => {
      try {
        const message = "The initiator " + username + " is no longer a lord.";
        sendMessage(message);
      } catch (err) {
        throw err;
      }
    });

    client.on("TimedPollTargetRoleChanged", async (username) => {
      console.log(
        "I am target role is running---------------------------------------------->"
      );
      try {
        const message = "The role of the target " + username + " has changed.";
        sendMessage(message);
      } catch (err) {
        throw err;
      }
    });

    eventListenersSetUp = true; // Set the flag to true
  }
}

async function startPoll(client, messageToEdit) {
  if (type == "noble") {
    pollTimeout = setTimeout(async () => {
      await handlePollEnd(client, messageToEdit);
    }, LordNobleTimedPollDuration);
  } else {
    pollTimeout = setTimeout(async () => {
      await handlePollEnd(client, messageToEdit);
    }, LordKingTimedPollDuration);
  }
}

async function handlePollEnd(client, messageToEdit) {
  console.log("I am a type------------------------>", type);
  const participationRate = pollParticipants.size / roleMembersSize;
  if (type == "noble") {
    if (pollActive && participationRate >= LordNobleTimedPollWinningRate) {
      // If Timed poll is sucessful
      const member = selectedMembers[pollInitiatorId];
      if (member)
        eventEmitter.emit(
          "changeRole",
          selectedMembers[pollInitiatorId],
          "Lord"
        );
      eventEmitter.emit(
        "TimedPollComplete",
        pollTargetName,
        pollInitiatorUsername
      );
      await resetPoll(client, messageToEdit);
    } else {
      eventEmitter.emit(
        "TimedPollFailed",
        pollTargetName,
        pollInitiatorUsername
      );
      await resetPoll(client, messageToEdit);
    }
  } else {
    if (pollActive && participationRate >= LordKingTimedPollWinningRate) {
      // If Timed poll is sucessful
      const member = selectedMembers[pollInitiatorId];
      if (member)
        eventEmitter.emit(
          "changeRole",
          selectedMembers[pollInitiatorId],
          "King"
        );
      eventEmitter.emit(
        "TimedPollComplete",
        pollTargetName,
        pollInitiatorUsername
      );
      await resetPoll(client, messageToEdit);
    } else {
      eventEmitter.emit(
        "TimedPollFailed",
        pollTargetName,
        pollInitiatorUsername
      );
      await resetPoll(client, messageToEdit);
    }
  }
}

// Function to trigger the poll early
async function triggerPollEarly(client, messageToEdit) {
  if (pollTimeout) {
    clearTimeout(pollTimeout); // Clear the original timeout
    await handlePollEnd(client, messageToEdit); // Manually trigger poll logic
  }
}

async function sendMessage(messsage) {
  interactions.forEach(async (interaction) => {
    if (!interaction) return;
    else {
      if (!interaction.replied && !interaction.deferred) {
        // Send the initial reply if it hasn't been replied to yet
        await interaction.reply({
          content: messsage,
          ephemeral: true,
        });
      } else {
        // Send a follow-up message if the interaction has already been replied to
        await interaction.followUp({
          content: messsage,
          ephemeral: true,
        });
      }
    }
  });
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
    const selectMenuNobles = await buildSelectMenu(
      client,
      ["noble"],
      "NobleSelectMenu"
    );
    const selectMenuLords = await buildSelectMenu(
      client,
      ["lord"],
      "LordSelectMenu"
    );
    const row_noble_select = new ActionRowBuilder().addComponents(
      selectMenuNobles
    );
    const row_lord_select = new ActionRowBuilder().addComponents(
      selectMenuLords
    );
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ElectLord")
        .setLabel("Elect Lord")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ElectKing")
        .setLabel("Elect King")
        .setStyle(ButtonStyle.Danger)
    );

    const message = await channel.send({
      content: initContent,
      components: [row_noble_select, row_lord_select, buttonRow],
    });
    return message;
  } catch (err) {
    showErrorMsg(err);
  }
}

async function resetPoll(client, messageToEdit) {
  try {
    pollInLastPhase = false;
    pollActive = false;
    pollInitiatorUsername = null;
    pollTargetName = null;
    pollTargetId = null;
    selectedMembers = {};
    pollInitiatorId = null;
    pollParticipants.clear();
    roleMembersSize = 1;
    roleMembers = [];

    const actionRow_0 = ActionRowBuilder.from(
      messageToEdit.components[0].toJSON()
    );
    const actionRow_1 = ActionRowBuilder.from(
      messageToEdit.components[1].toJSON()
    );

    const nobleSelectMenu = await buildSelectMenu(
      client,
      ["noble"],
      "NobleSelectMenu"
    );
    const lordSelectMenu = await buildSelectMenu(
      client,
      ["lord"],
      "LordSelectMenu"
    );

    actionRow_0.components[0] = nobleSelectMenu;
    actionRow_1.components[0] = lordSelectMenu;

    // Reset poll button
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ElectLord")
        .setLabel("Elect Lord")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ElectKing")
        .setLabel("Elect King")
        .setStyle(ButtonStyle.Danger)
    );

    await messageToEdit.edit({
      content: initContent,
      components: [actionRow_0, actionRow_1, buttonRow],
    });
  } catch (err) {
    throw err;
  }
}

module.exports = { setupLordBotEvents, messageLordCommands };
