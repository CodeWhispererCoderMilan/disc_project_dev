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
    if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
			oldMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
			oldMember.roles.cache.has(process.env.ROLEID_LORD) ||
			oldMember.roles.cache.has(process.env.ROLEID_KING) ||
			newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			newMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
			newMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
			newMember.roles.cache.has(process.env.ROLEID_LORD) ||
			newMember.roles.cache.has(process.env.ROLEID_KING)) {
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
        await interaction.reply({
          content: `Successfully granted ${xpAmount} XP to ${targetMember.user.username}. Message: ${optionalMessage}`,
          ephemeral: true,
        });
        await CacheSetCooldown("MerchantCooldown", userId, MerchantCoolDown);
	eventEmitter.emit("BribeComplete", targetMember.user.id);
      } catch (err) {
        showErrorMsg(err);
      }
    }
  });
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



module.exports = { setupMerchantBotEvents, messageMerchantCommands };
