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
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { DBUpdateXP } = require("../apis/firebase/querys");
const {
  DegradationCost,
  DegradationCooldown,
  KnightCost,
  KnightCooldown,
  SiegeCoolDown,
  SiegeCost,
  RoleChangeMessageDisplayTime,
} = require("../game_config.json");

const initContent =
  "Test message to King.\n" +
  "**Abilities:**\n" +
  "- **Degradation**: Choose Knight to degradation to merchant\n" +
  "- **Knight**: Choose peasant, scholar, merchant select to make him knight\n" +
  "- **Siege**: Choose a king to make him poop\n";

let selectedHumans = {};
let selectedKnights = {};
let selectedKings = {};
let kings = [];
let kingSize = 1;
let siegeInitiatorId = null;
let siegeInitiatorUsername = "";
let siegeTargetName = "";
let siegeActive = false;

function showErrorMsg(err) {
  console.error("ERROR: king_commands.js", err);
}

async function setupKingBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const hadRoleBeforeKing = oldMember.roles.cache.has(
      process.env.ROLEID_KING
    );
    const hasRoleNowKing = newMember.roles.cache.has(process.env.ROLEID_KING);
    if (siegeActive && hadRoleBeforeKing && !hasRoleNowKing) {
      if (newMember.id === siegeInitiatorId) {
        // If the initiator lost the role, reset the poll
        eventEmitter.emit("SiegeInitiatorRoleChanged");
        return;
      }
    }
    if (
      oldMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
      oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
      oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
      oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
      oldMember.roles.cache.has(process.env.ROLEID_KING) ||
      newMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
      newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
      newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
      newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
      newMember.roles.cache.has(process.env.ROLEID_KING)
    ) {
      await updateSelectMenu(client, lastMessageId);
    }
  });
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
    if (interaction.customId === "SelectDegradation") {
      const userId = interaction.user.id;
      let selectedKnightId = interaction.values[0];
      selectedKnights[userId] = await interaction.guild.members.cache.get(
        selectedKnightId
      );
      await interaction.deferUpdate();
    }
    if (interaction.customId === "SelectKnight") {
      const userId = interaction.user.id;
      let selectedKnightId = interaction.values[0];
      selectedHumans[userId] = await interaction.guild.members.cache.get(
        selectedKnightId
      );
      await interaction.deferUpdate();
    }
    if (interaction.customId === "SelectKing") {
      try {
        const userId = interaction.user.id;
        let selectedKingId = interaction.values[0];
        selectedKings[userId] = await interaction.guild.members.cache.get(
          selectedKingId
        );
        await interaction.deferUpdate();
      } catch (error) {
        showErrorMsg(error);
      }
    }

    if (interaction.customId === "DegradationKnight") {
      try {
        const userId = interaction.user.id;
        if (!selectedKnights[userId]) {
          await sendInteractionReply(interaction, `No knight selected`);
          return;
        }
        const userXP = await CacheGetUserXP(userId);
        if (userXP < DegradationCost) {
          await sendInteractionReply(
            interaction,
            `Not enough XP (current XP: ${userXP})`
          );
          return;
        } else {
          const cooldown = await CacheGetCooldown("degradationKnight", userId);
          if (cooldown) {
            await sendInteractionReply(
              interaction,
              "Degradation is on cooldown and cannot be used"
            );
            return;
          } else {
            eventEmitter.emit(
              "changeRole",
              selectedKnights[userId],
              "Merchant"
            );
            const targetUsername = selectedKnights[userId].user.username;
            selectedKnights[userId] = null;
            await DBUpdateXP(userId, -DegradationCost, client);
            await CacheSetCooldown(
              "degradationKnight",
              userId,
              DegradationCooldown
            );
            eventEmitter.emit(
              "DegradationComplete",
              targetUsername,
              interaction.user.username
            );
            const XPLeft = parseInt(userXP) - parseInt(DegradationCost);
            await sendInteractionReply(
              interaction,
              `(${XPLeft} XP left) Degradation  successful. \n${targetUsername} has been reduced to merchant`
            );
          }
        }
      } catch (err) {
        showErrorMsg(err);
      }
    }
    if (interaction.customId === "Knight") {
      try {
        const userId = interaction.user.id;
        if (!selectedHumans[userId]) {
          await sendInteractionReply(
            interaction,
            `no peasant, scholar or merchant selected...`
          );
          return;
        }
        const userXP = await CacheGetUserXP(userId);
        if (userXP < KnightCost) {
          await sendInteractionReply(
            interaction,
            `Not enough XP (current XP: ${userXP})`
          );
          return;
        } else {
          const cooldown = await CacheGetCooldown("knight", userId);
          if (cooldown) {
            await sendInteractionReply(
              interaction,
              "Knight is on cooldown and cannot be used"
            );
            return;
          } else {
            eventEmitter.emit("changeRole", selectedHumans[userId], "Knight");
            const targetUsername = selectedHumans[userId].user.username;
            selectedHumans[userId] = null;
            await DBUpdateXP(userId, -KnightCost, client);
            await CacheSetCooldown("knight", userId, KnightCooldown);
            eventEmitter.emit(
              "KnightComplete",
              targetUsername,
              interaction.user.username
            );
            const XPLeft = parseInt(userXP) - parseInt(KnightCost);
            await sendInteractionReply(
              interaction,
              `(${XPLeft} XP left) ${targetUsername} has been knighted`
            );
          }
        }
      } catch (err) {
        showErrorMsg(err);
      }
    }
    if (interaction.customId === "Siege") {
      try {
        const userId = interaction.user.id;
        kings = interaction.guild.members.cache.filter((member) =>
          member.roles.cache.has(process.env.ROLEID_KING)
        );
        kingSize = kings.size;

        if (!selectedKings[userId]) {
          await sendInteractionReply(interaction, "No king selected");
          return;
        }

        const userXP = await CacheGetUserXP(userId);
        if (userXP < SiegeCost) {
          await sendInteractionReply(
            interaction,
            `Not enough XP (current XP: ${userXP})`
          );
          return;
        }
        if (selectedKings[userId].user.id === userId) {
          await sendInteractionReply(
            interaction,
            "You cannot target yourself."
          );
          return;
        }

        const cooldown = await CacheGetCooldown("Siege", userId);
        if (cooldown) {
          await sendInteractionReply(interaction, "Siege is on cooldown");
          return;
        }

        siegeInitiatorId = userId;
        siegeInitiatorUsername = interaction.user.username;
        siegeActive = true;
        siegeTargetName = selectedKings[userId].user.username;

        const channel = await client.channels.fetch(process.env.CHANNELIDKING);
        if (lastMessageId) {
          // Set cooldown
          await CacheSetCooldown("Siege", userId, SiegeCoolDown);
        }

        console.log("LAST MESSAGE ID ===>", lastMessageId);

        const messageToEdit = await channel.messages.fetch(lastMessageId);
        const actionRow_0 = ActionRowBuilder.from(
          messageToEdit.components[0].toJSON()
        );
        const actionRow_1 = ActionRowBuilder.from(
          messageToEdit.components[1].toJSON()
        );
        const actionRow_2 = ActionRowBuilder.from(
          messageToEdit.components[2].toJSON()
        );
        const kingSelectMenu = StringSelectMenuBuilder.from(
          actionRow_2.components[0].toJSON()
        )
          .setDisabled(true)
          .setPlaceholder(siegeTargetName);
        actionRow_2.components[0] = kingSelectMenu;
        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("DegradationKnight")
            .setLabel("Degradation Knight")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("Knight")
            .setLabel("Knight")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("Siege")
            .setLabel("Siege")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );
        const content =
          initContent +
          `\n@${siegeInitiatorUsername} initiated a siege to downgrade ${siegeTargetName}.`;
        await messageToEdit.edit({
          content,
          components: [actionRow_0, actionRow_1, actionRow_2, btnRow],
        });

        eventEmitter.emit(
          "siegeStarted",
          siegeInitiatorUsername,
          siegeTargetName
        );
        await sendInteractionReply(
          interaction,
          "Siege initiated, waiting for knights to join your siege."
        );
      } catch (err) {
        showErrorMsg(err);
      }
    }
  });

  eventEmitter.on(
    "coronationComplete",
    async (kingUsername, initiatorUsername) => {
      try {
        const channel = await client.channels.fetch(process.env.CHANNELIDKING);
        const tmpMessage = await channel.send(
          `Coronation successfully! ${kingUsername} has become a king by ${initiatorUsername}.`
        );
        setTimeout(() => {
          tmpMessage.delete().catch(showErrorMsg);
        }, 30000);
      } catch (err) {
        showErrorMsg(err);
      }
    }
  );
  eventEmitter.on(
    "heirSuccessionComplete",
    async (heirUsername, initiatorUsername) => {
      try {
        const channel = await client.channels.fetch(process.env.CHANNELIDKING);
        const tmpMessage = await channel.send(
          `Hail the new Emperor! ${heirUsername} heir to ${initiatorUsername} has taken the throne,`
        );
        setTimeout(() => {
          tmpMessage.delete().catch(showErrorMsg);
        }, 30000);
      } catch (err) {
        showErrorMsg(err);
      }
    }
  );
  eventEmitter.on(
    "SiegeFinished",
    async (siegeParticipantsSize, knightsSize) => {
      try {
        const success = siegeParticipantsSize >= knightsSize / kingSize;
        let message = "";
        if (success) {
          eventEmitter.emit(
            "changeRole",
            selectedKings[siegeInitiatorId],
            "Poop"
          );
          message =
            "Siege succeded! " +
            siegeTargetName +
            " has become a poop by " +
            siegeInitiatorUsername +
            ".";
        } else {
          message =
            "Siege on " +
            siegeTargetName +
            " initiated by " +
            siegeInitiatorUsername +
            " has been failed.";
        }
        if (siegeActive) {
          eventEmitter.emit("NotifyKingChannel", message);
          eventEmitter.emit("siegeResult", message, "normal");
        }

        // Reset
        const channel = await client.channels.fetch(process.env.CHANNELIDKING);
        const messageToEdit = await channel.messages.fetch(lastMessageId);
        await resetComponents(client, messageToEdit);
      } catch (err) {
        showErrorMsg(err);
      }
    }
  );
  eventEmitter.on(
    "KnightParticipatedOnSiege",
    async (siegeParticipantsSize, knightsSize) => {
      try {
        const channel = await client.channels.fetch(process.env.CHANNELIDKING);
        const messageToEdit = await channel.messages.fetch(lastMessageId);

        const content =
          initContent +
          `\n@${siegeInitiatorUsername} initiated a siege to downgrade ${siegeTargetName}. Currently joined ${siegeParticipantsSize} out of ${knightsSize}.`;
        const existingComponents = messageToEdit.components.map((component) =>
          ActionRowBuilder.from(component.toJSON())
        );
        await messageToEdit.edit({
          content,
        });
      } catch (err) {
        showErrorMsg(err);
      }
    }
  );
  eventEmitter.on("SiegeInitiatorRoleChanged", async () => {
    try {
      const message = "The role of the initiator has been changed.";
      eventEmitter.emit("siegeResult", message, "early");
      eventEmitter.emit("NotifyKingChannel", message);

      //Reset
      const channel = await client.channels.fetch(process.env.CHANNELIDKING);
      const messageToEdit = await channel.messages.fetch(lastMessageId);
      await resetComponents(client, messageToEdit);
    } catch (err) {
      showErrorMsg(err);
    }
  });
  eventEmitter.on("NotifyKingChannel", async (content) => {
    try {
      let channel = await client.channels.fetch(process.env.CHANNELIDKING);
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

async function updateSelectMenu(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDKING);
    const messageToEdit = await channel.messages.fetch(lastMessageId);
    const actionRow_0 = new ActionRowBuilder().addComponents(
      await buildSelectMenu(client, ["knight"], "SelectDegradation")
    );
    const actionRow_1 = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["peasant", "scholar", "merchant"],
        "SelectKnight"
      )
    );
    const actionRow_2 = ActionRowBuilder.from(
      messageToEdit.components[2].toJSON()
    );
    const actionRow_3 = ActionRowBuilder.from(
      messageToEdit.components[3].toJSON()
    );

    if (siegeActive) {
      const kingSelectMenu = StringSelectMenuBuilder.from(
        actionRow_2.components[0].toJSON()
      )
        .setDisabled(true)
        .setPlaceholder(siegeTargetName);
      actionRow_2.components[0] = kingSelectMenu;
      actionRow_3.components[2].setDisabled(true);
    } else {
      const kingSelectMenu = await buildSelectMenu(
        client,
        ["king"],
        "SelectKing"
      );
      actionRow_2.components[0] = kingSelectMenu;
      actionRow_3.components[2].setDisabled(false);
    }
    const existingComponents = messageToEdit.components.map((component) =>
      ActionRowBuilder.from(component.toJSON())
    );
    existingComponents[0] = actionRow_0;
    existingComponents[1] = actionRow_1;
    existingComponents[2] = actionRow_2;
    existingComponents[3] = actionRow_3;

    await messageToEdit.edit({
      components: existingComponents,
    });
  } catch (err) {
    showErrorMsg(err);
  }
}

async function messageKingCommands(client) {
  let channel = null;
  try {
    channel = await client.channels.fetch(process.env.CHANNELIDKING);
    const degradationSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(client, ["knight"], "SelectDegradation")
    );
    const knightSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["peasant", "scholar", "merchant"],
        "SelectKnight"
      )
    );
    const kingSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(client, ["king"], "SelectKing")
    );

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("DegradationKnight")
        .setLabel("Degradation Knight")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("Knight")
        .setLabel("Knight")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("Siege")
        .setLabel("Siege")
        .setStyle(ButtonStyle.Danger)
    );
    return await channel.send({
      content: initContent,
      components: [
        degradationSelectMenu,
        knightSelectMenu,
        kingSelectMenu,
        btnRow,
      ],
    });
  } catch (err) {
    showErrorMsg(err);
  }
}

async function resetComponents(client, messageToEdit) {
  try {
    siegeActive = false;
    selectedHumans = {};
    selectedKnights = {};
    selectedKings = {};
    kings = [];
    kingSize = 1;
    siegeInitiatorUsername = "";
    siegeTargetName = "";

    const degradationSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(client, ["knight"], "SelectDegradation")
    );
    const knightSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["peasant", "scholar", "merchant"],
        "SelectKnight"
      )
    );
    const kingSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(client, ["king"], "SelectKing")
    );

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("DegradationKnight")
        .setLabel("Degradation Knight")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("Knight")
        .setLabel("Knight")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("Siege")
        .setLabel("Siege")
        .setStyle(ButtonStyle.Danger)
    );

    await messageToEdit.edit({
      content: initContent,
      components: [
        degradationSelectMenu,
        knightSelectMenu,
        kingSelectMenu,
        btnRow,
      ],
    });
  } catch (err) {
    throw err;
  }
}

module.exports = { setupKingBotEvents, messageKingCommands };
