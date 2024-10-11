const { eventEmitter } = require("../functions/eventEmitter.js");
const {
	sendInteractionReply,
} = require("../functions/botActions");
const {
	CacheGetCooldown,
	CacheSetCooldown,
} = require("../apis/redis/redisCache");
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require("discord.js");
const {
	ScholarSendMessageCoolDown,
} = require("../game_config.json");

const content =
	"Test message to Scholar.\n" +
	"**Abilities:**\n" +
	"- **SendMessage**: Send message to the Royal Castle\n";

function showErrorMsg(err) {
	console.error("ERROR: scholar_commands.js", err);
}

async function setupScholarBotEvents(client, lastMessageId) {
	client.on("interactionCreate", async (interaction) => {
		const userId = interaction.user.id;
		if (interaction.isButton()) {
			if (interaction.customId === "SendMessage") {
				const modal = new ModalBuilder()
					.setCustomId("royalCastleModal")
					.setTitle("Send Message to Royal Castle");

				const messageInput = new TextInputBuilder()
					.setCustomId("messageInput")
					.setLabel("Enter your message:")
					.setStyle(TextInputStyle.Paragraph);

				const actionRow = new ActionRowBuilder().addComponents(messageInput);

				modal.addComponents(actionRow);

				const cooldown = await CacheGetCooldown(
					"sendMessageToRoyalCastle",
					userId
				);
				if (cooldown) {
					await sendInteractionReply(
						interaction,
						"This ability is on cooldown and cannot be used"
					);

					return;
				}

				await interaction.showModal(modal);
			}
		}

		if (interaction.isModalSubmit()) {
			if (interaction.customId === "royalCastleModal") {
				const message = interaction.fields.getTextInputValue("messageInput");

				try {
					// Defer reply to avoid timeout
					await interaction.deferReply({ ephemeral: true });

					// Emit event
					eventEmitter.emit("sendMessageToRoyalCastle", userId, message);

					// Set cooldown (e.g., 60 seconds)
					await CacheSetCooldown(
						"sendMessageToRoyalCastle",
						userId,
						ScholarSendMessageCoolDown
					);

					await sendInteractionReply(
						interaction,
						"You have successfuly sent message to the royal castle."
					);
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
	});
}

async function messageScholarCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDSCHOLAR);
		const btnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("SendMessage")
			.setLabel("Send to Royal Castle")
			.setStyle(ButtonStyle.Primary)
		);

		return await channel.send({
			content,
			components: [btnRow],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

module.exports = { setupScholarBotEvents, messageScholarCommands };
