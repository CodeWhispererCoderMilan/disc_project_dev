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
  AssassinationTime,
  AssassinationThreadshold,
  GlobalCoolDown,
  RoleChangeMessageDisplayTime,
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedTargets = {};
let nobles = [];
let noblesSize = 1;
let assassinationInitiatorId = null;
let assassinationInitiatorUsername = null;
let assassinationTargetName = null;
let assassinationTargetId = null;
let assassinationActive = false;
let assassinationParticipants = new Set();
let assassinationTimeout;

function showErrorMsg(err) {
  console.error("ERROR: noble_commands.js", err);
}

const initContent =
  "Nobles can assassin a target of their role by selecting Knight, Noble or Lord in a menu and clicking a button. If over 3 of participants join before the timer ends, the target's role is changed to POOP; otherwise, the attempt fails. A global cooldown is activated after each use.\n\n" +
  "**Abilities:**\n" +
  "- **Assassination**: With more than 3 of Nobles, you can make one knight, noble or lord to poop.";

async function setupNobleBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const hadRoleBeforeKnight = oldMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );
    const hasRoleNowKnight = newMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );
    const hadRoleBeforeNoble = oldMember.roles.cache.has(
      process.env.ROLEID_NOBLE
    );
    const hasRoleNowNoble = newMember.roles.cache.has(process.env.ROLEID_NOBLE);
    const hadRoleBeforeLord = oldMember.roles.cache.has(
      process.env.ROLEID_LORD
    );
    const hasRoleNowLord = newMember.roles.cache.has(process.env.ROLEID_LORD);
    const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
    const messageToEdit = await channel.messages.fetch(lastMessageId);
    if (assassinationActive && !hasRoleNowNoble && hadRoleBeforeNoble) {
      if (assassinationParticipants.has(newMember.id)) {
        try {
          selectedTargets[newMember.id] = null;
          assassinationParticipants.delete(newMember.id);

          if (newMember.id === assassinationInitiatorId) {
            const msg = `The initiator @${assassinationInitiatorUsername} is no longer a noble.`;
            eventEmitter.emit("NotifyNobleChannel", msg);
            assassinationActive = false;
            await ceaseAssassination(client, messageToEdit);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (
      assassinationActive &&
      ((hadRoleBeforeKnight && !hasRoleNowKnight) ||
        (hadRoleBeforeNoble && !hasRoleNowNoble) ||
        (hadRoleBeforeLord && !hasRoleNowLord))
    ) {
      if (newMember.id === assassinationTargetId) {
        try {
          const msg = `The role of the target @${username} has been changed.`;
          eventEmitter.emit("NotifyNobleChannel", msg);
          assassinationActive = false;
          await ceaseAssassination(client, messageToEdit);
          return;
        } catch (e) {
          showErrorMsg(e);
        }
      }
    }
    if (
      hadRoleBeforeKnight ||
      hasRoleNowKnight ||
      hadRoleBeforeNoble ||
      hasRoleNowNoble ||
      hadRoleBeforeLord ||
      hasRoleNowLord
    ) {
      if (lastMessageId) {
        try {
          const guild = await client.guilds.fetch(process.env.GUILDID);
          await guild.members.fetch();
          nobles = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_NOBLE)
          );
          noblesSize = nobles.size;

          const channel = await client.channels.fetch(
            process.env.CHANNELIDNOBLE
          );
          const messageToEdit = await channel.messages.fetch(lastMessageId);
          let content = initContent;
          if (assassinationActive) {
            content =
              content +
              `\n@${assassinationInitiatorUsername} initiated an assassination. Join assassination to downgrade @${assassinationTargetName}. (Joined ${assassinationParticipants.size} / ${noblesSize}.)`;
            if (assassinationParticipants.size >= AssassinationThreadshold) {
              ceaseAssassination(client, messageToEdit);
              return;
            }
          }
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );

          if (assassinationActive) {
            const memberSelectMenu = StringSelectMenuBuilder.from(
              actionRow_0.components[0].toJSON()
            )
              .setDisabled(true)
              .setPlaceholder(assassinationInitiatorUsername);
            actionRow_0.components[0] = memberSelectMenu;
          } else {
            const memberSelectMenu = await buildSelectMenu(
              client,
              ["knight", "noble", "lord"],
              "AssassinationTargetSelectMenu"
            );
            actionRow_0.components[0] = memberSelectMenu;
          }
          const existingComponents = messageToEdit.components.map((component) =>
            ActionRowBuilder.from(component.toJSON())
          );
          const actionRow_1 = ActionRowBuilder.from(
            messageToEdit.components[1].toJSON()
          );
          if (assassinationActive) {
            const assassinationBtn = ButtonBuilder.from(
              actionRow_1.components[0].toJSON()
            );
            assassinationBtn.setDisabled(true);
            const joinBtn = new ButtonBuilder()
              .setCustomId("JoinAssassination")
              .setLabel("Join Assassination")
              .setStyle(ButtonStyle.Primary);
            actionRow_1.components[0] = assassinationBtn;
            actionRow_1.components[1] = joinBtn;
            existingComponents[1] = actionRow_1;
          } else {
            // Reset assassination button
            const buttonRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("Assassination")
                .setLabel("Assassination")
                .setStyle(ButtonStyle.Danger)
            );
            existingComponents[1] = buttonRow;
          }
          existingComponents[0] = actionRow_0;
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

    if (interaction.customId === "AssassinationTargetSelectMenu") {
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

    if (interaction.customId === "Assassination") {
      const userId = interaction.user.id;
      nobles = interaction.guild.members.cache.filter((member) =>
        member.roles.cache.has(process.env.ROLEID_NOBLE)
      );
      noblesSize = nobles.size;

      let cooldown;
      try {
        cooldown = await CacheGetCooldown("NobleCooldown", userId);
      } catch (err) {
        showErrorMsg(err);
      }
      if (cooldown) {
        sendInteractionReply(interaction, "Assassination is on cooldown");
        return;
      }

      if (!selectedTargets[userId]) {
        sendInteractionReply(interaction, "No member selected");
        return;
      }

      if (selectedTargets[userId].user.id === userId) {
        sendInteractionReply(interaction, "You cannot target yourself.");
        return;
      }

      assassinationInitiatorId = userId;
      assassinationInitiatorUsername = interaction.user.username;
      assassinationParticipants.add(userId);
      assassinationActive = true;
      assassinationTargetName = selectedTargets[userId].user.username;
      assassinationTargetId = selectedTargets[userId].user.id;

      const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
      if (lastMessageId) {
        try {
          // Set cooldown
          await CacheSetCooldown("NobleCooldown", userId, GlobalCoolDown);

          const messageToEdit = await channel.messages.fetch(lastMessageId);
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );
          const memberSelectMenu = StringSelectMenuBuilder.from(
            actionRow_0.components[0].toJSON()
          )
            .setDisabled(true)
            .setPlaceholder(selectedTargets[userId].user.username);
          actionRow_0.components[0] = memberSelectMenu;

          const actionRow_1 = ActionRowBuilder.from(
            messageToEdit.components[1].toJSON()
          );
          const assassinationBtn = ButtonBuilder.from(
            actionRow_1.components[0].toJSON()
          );
          assassinationBtn.setDisabled(true);
          const joinBtn = new ButtonBuilder()
            .setCustomId("JoinAssassination")
            .setLabel("Join Assassination")
            .setStyle(ButtonStyle.Primary);
          actionRow_1.components[0] = assassinationBtn;
          actionRow_1.components[1] = joinBtn;

          const content =
            initContent +
            `\n@${assassinationInitiatorUsername} initiated an assassination. Join assassination to downgrade @${assassinationTargetName}. (Joined ${assassinationParticipants.size} / ${noblesSize}.)`;
          await messageToEdit.edit({
            content,
            components: [actionRow_0, actionRow_1],
          });

          await startAssassination(client, messageToEdit, AssassinationTime);

          await sendInteractionReply(
            interaction,
            "Assassination initiated, waiting for other nobles to join your assassination"
          );
          if (assassinationParticipants.size >= AssassinationThreadshold) {
            ceaseAssassination(client, messageToEdit);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (interaction.customId === "JoinAssassination") {
      try {
        if (!assassinationActive) {
          await sendInteractionReply(
            interaction,
            "There is no active assassination to join."
          );
          return;
        }

        const userId = interaction.user.id;
        if (userId === assassinationInitiatorId) {
          await sendInteractionReply(
            interaction,
            "Once you created an assassination, you don't need to join your assassination since you are alreday a participant."
          );
          return;
        }

        if (assassinationParticipants.has(userId)) {
          await sendInteractionReply(
            interaction,
            "You've already joined this assassination."
          );
          return;
        }

        assassinationParticipants.add(userId);
        await sendInteractionReply(
          interaction,
          "You have joind the assassination."
        );

        const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
        const messageToEdit = await channel.messages.fetch(lastMessageId);
        if (
          assassinationActive &&
          assassinationParticipants.size >= AssassinationThreadshold
        ) {
          //If assassination succeeded within voting ending time.
          ceaseAssassination(client, messageToEdit);
          return;
        } else {
          const editedContent =
            initContent +
            `\n@${assassinationInitiatorUsername} initiated an assassination. Join assassination to downgrade @${assassinationTargetName}. (Joined ${assassinationParticipants.size} / ${noblesSize}.)`;

          await messageToEdit.edit({ content: editedContent });
        }
      } catch (err) {
        throw err;
      }
    }
  });
  eventEmitter.on("NotifyNobleChannel", async (msg) => {
    try {
      let channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
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

async function startAssassination(client, messageToEdit, timeout) {
  assassinationTimeout = setTimeout(async () => {
    await handleAssassinationEnd(client, messageToEdit);
  }, timeout);
}

async function handleAssassinationEnd(client, messageToEdit) {
  if (
    assassinationActive &&
    assassinationParticipants.size >= AssassinationThreadshold
  ) {
    // If Timed assassination is sucessful
    const member = selectedTargets[assassinationInitiatorId];
    if (member)
      eventEmitter.emit(
        "changeRole",
        selectedTargets[assassinationInitiatorId],
        "Poop"
      );
    const msg = `Assassination successful! @${assassinationTargetName} has become a poop by @${assassinationInitiatorUsername}.`;
    eventEmitter.emit("NotifyNobleChannel", msg);
    await resetComponents(client, messageToEdit);
  } else {
    const msg = `Assassination on @${assassinationTargetName} initiated by @${assassinationInitiatorUsername} has been failed.`;
    eventEmitter.emit("NotifyNobleChannel", msg);
    await resetComponents(client, messageToEdit);
  }
}

// Function to trigger the assassination early
async function ceaseAssassination(client, messageToEdit) {
  if (assassinationTimeout) {
    clearTimeout(assassinationTimeout); // Clear the original timeout
    await handleAssassinationEnd(client, messageToEdit); // Manually trigger assassination logic
  }
}

async function messageNobleCommands(client) {
  let channel = null;
  try {
    channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
  } catch (err) {
    showErrorMsg(err);
    return;
  }

  try {
    const selectMenu = await buildSelectMenu(
      client,
      ["knight", "noble", "lord"],
      "AssassinationTargetSelectMenu"
    );
    const row_knight_noble_lord_select = new ActionRowBuilder().addComponents(
      selectMenu
    );
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("Assassination")
        .setLabel("Assassination")
        .setStyle(ButtonStyle.Danger)
    );

    const message = await channel.send({
      content: initContent,
      components: [row_knight_noble_lord_select, buttonRow],
    });
    return message;
  } catch (err) {
    showErrorMsg(err);
  }
}

async function resetComponents(client, messageToEdit) {
  try {
    pollInLastPhase = false;
    assassinationActive = false;
    assassinationInitiatorUsername = null;
    assassinationTargetName = null;
    assassinationTargetId = null;
    selectedTargets = {};
    assassinationInitiatorId = null;
    assassinationParticipants.clear();
    noblesSize = 1;
    nobles = [];

    const actionRow_0 = ActionRowBuilder.from(
      messageToEdit.components[0].toJSON()
    );

    const memberSelectMenu = await buildSelectMenu(
      client,
      ["knight", "noble", "lord"],
      "AssassinationTargetSelectMenu"
    );

    actionRow_0.components[0] = memberSelectMenu;

    // Reset assassination button
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("Assassination")
        .setLabel("Assassination")
        .setStyle(ButtonStyle.Danger)
    );

    await messageToEdit.edit({
      content: initContent,
      components: [actionRow_0, buttonRow],
    });
  } catch (err) {
    throw err;
  }
}

module.exports = { setupNobleBotEvents, messageNobleCommands };
