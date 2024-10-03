const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const {
  buildSelectMenu,
  sendInteractionReply,
} = require("../functions/botActions");
const {
  CacheGetUserXP,
  CacheGetCooldown,
  CacheSetCooldown,
} = require("../apis/redis/redisCache");
const { DBUpdateXP } = require("../apis/firebase/querys");
const { eventEmitter } = require("../functions/eventEmitter.js");
const { MerchantCoolDown } = require("../game_config.json");

let selectedMembers = {};
let selectedMemberId = "";

const initContent =
  "Merchants can trigger bride to give xp to a target by selecting Peasant,Merchant,Knight, Noble, Lord or King in a menu and clicking a button. There will be displayed a modal and should enter xp and message(optional) to give.\n\n" +
  "**Abilities:**\n" +
  "- **Bribe**: Enter xp and message to give to a target.";

function showErrorMsg(err) {
  console.error("ERROR: noble_commands.js", err);
}

async function setupMerchantBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const hadRoleBeforeMerchant = oldMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );
    const hasRoleNowMerchant = newMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );
    if (hadRoleBeforeMerchant || hasRoleNowMerchant) {
      await updateSelectMenu(client, lastMessageId);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    const userId = interaction.user.id;

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "MembersSelectMenu"
    ) {
      selectedMemberId = interaction.values[0];
      try {
        selectedMembers[selectedMemberId] =
          await interaction.guild.members.cache.get(selectedMemberId);
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.isButton() && interaction.customId === "Bribe") {
      if (!selectedMembers[selectedMemberId]) {
        await sendInteractionReply(interaction, "Choose a member");
      } else {
        let cooldown;
        try {
          cooldown = await CacheGetCooldown("MerchantCooldown", userId);
        } catch (err) {
          showErrorMsg(err);
        }
        if (cooldown) {
          sendInteractionReply(interaction, "Bribe is on cooldown");
          return;
        }
        // Display the modal
        const modal = new ModalBuilder()
          .setCustomId("xpModal")
          .setTitle("Grant XP to Member");

        const xpInput = new TextInputBuilder()
          .setCustomId("xpAmount")
          .setLabel("XP Amount")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Enter XP to grant")
          .setRequired(true);

        const messageInput = new TextInputBuilder()
          .setCustomId("optionalMessage")
          .setLabel("Optional Message")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Enter an optional message")
          .setRequired(false);

        const xpActionRow = new ActionRowBuilder().addComponents(xpInput);
        const messageActionRow = new ActionRowBuilder().addComponents(
          messageInput
        );

        modal.addComponents(xpActionRow, messageActionRow);

        await interaction.showModal(modal);
      }
    }

    // Handle modal submission
    if (interaction.isModalSubmit() && interaction.customId === "xpModal") {
      const xpAmount = Number(interaction.fields.getTextInputValue("xpAmount"));
      const optionalMessage =
        interaction.fields.getTextInputValue("optionalMessage") ||
        "No message provided";

      try {
        const merchantXPText = await CacheGetUserXP(userId);
        const merchantXP = Number(merchantXPText);
        if (merchantXP < xpAmount) {
          await interaction.reply({
            content: `You don't have enough XP to grant ${xpAmount}. You only have ${merchantXP} XP.`,
            ephemeral: true,
          });
          return;
        }

        // Deduct XP from merchant
        await DBUpdateXP(interaction.user.id, -xpAmount, client);

        // Give XP to the target member
        const targetMember = selectedMembers[selectedMemberId];
        await DBUpdateXP(targetMember.user.id, xpAmount, client);
        const channel = await client.channels.fetch(
          process.env.CHANNELIDMERCHANT
        );
        const messageToEdit = await channel.messages.fetch(lastMessageId);
        await interaction.reply({
          content: `Successfully granted ${xpAmount} XP to ${targetMember.user.username}. Message: ${optionalMessage}`,
          ephemeral: true,
        });
        await CacheSetCooldown("MerchantCooldown", userId, MerchantCoolDown);
        notifyTarget(
          `You have been granted ${xpAmount} XP by ${interaction.user.username}. Message: ${optionalMessage}`
        );
        await resetPoll(client, messageToEdit);
      } catch (err) {
        showErrorMsg(err);
      }
    }
  });
}

// Function to notify target member
async function notifyTarget(messageContent) {
  selectedMembers[selectedMemberId].send(messageContent).catch(showErrorMsg);
}

async function updateSelectMenu(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDMERCHANT);
    const messageToEdit = await channel.messages.fetch(lastMessageId);
    const actionRow_0 = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        [
          "peasant",
          "scholar",
          "merchant",
          "knight",
          "noble",
          "lord",
          "king",
          "emperor",
        ],
        "MembersSelectMenu"
      )
    );

    const existingComponents = messageToEdit.components.map((component) =>
      ActionRowBuilder.from(component.toJSON())
    );
    existingComponents[0] = actionRow_0;

    await messageToEdit.edit({
      content: initContent,
      components: existingComponents,
    });
  } catch (err) {
    showErrorMsg(err);
  }
}

async function messageMerchantCommands(client) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDMERCHANT);
    const roleMemberSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        [
          "peasant",
          "scholar",
          "merchant",
          "knight",
          "noble",
          "lord",
          "king",
          "emperor",
        ],
        "MembersSelectMenu"
      )
    );
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("Bribe")
        .setLabel("Bribe")
        .setStyle(ButtonStyle.Danger)
    );

    return await channel.send({
      content: initContent,
      components: [roleMemberSelectMenu, btnRow],
    });
  } catch (err) {
    showErrorMsg(err);
  }
}

async function resetPoll(client, messageToEdit) {
  console.log("I am resetPoll is running--------------------------->");
  try {
    selectedMembers = {};
    selectedMemberId = "";
    const actionRow_0 = ActionRowBuilder.from(
      messageToEdit.components[0].toJSON()
    );

    const memberSelectMenu = await buildSelectMenu(
      client,
      [
        "peasant",
        "scholar",
        "merchant",
        "knight",
        "noble",
        "lord",
        "king",
        "emperor",
      ],
      "MembersSelectMenu"
    );

    actionRow_0.components[0] = memberSelectMenu;

    // Reset poll button
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("Bribe")
        .setLabel("Bribe")
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

module.exports = { setupMerchantBotEvents, messageMerchantCommands };
