const { GatewayIntentBits, Client } = require("discord.js");
const { eventEmitter } = require("./functions/eventEmitter.js");
const gameState = require("./game_state.js");
const {
	setupConsoleBotEvents,
	messageConsoleCommands,
} = require("./role_commands/console_commands");
const {
	setupPoopBotEvents,
	messagePoopCommands,
} = require("./role_commands/poop_commands");
const {
	setupMaggotBotEvents,
	messageMaggotCommands,
} = require("./role_commands/maggot_commands");
const {
	setupCockroachBotEvents,
	messageCockroachCommands,
} = require("./role_commands/cockroach_commands");
const {
	setupRatBotEvents,
	messageRatCommands,
} = require("./role_commands/rat_commands");
const {
	setupSubhumanBotEvents,
	messageSubhumanCommands,
} = require("./role_commands/subhuman_commands");
const {
	setupPeasantBotEvents,
	messagePeasantCommands,
} = require("./role_commands/peasant_commands");
const {
	setupMerchantBotEvents,
	messageMerchantCommands,
} = require("./role_commands/merchant_commands");
const {
	setupScholarBotEvents,
	messageScholarCommands,
} = require("./role_commands/scholar_commands");
const {
	setupKnightBotEvents,
	messageKnightCommands,
} = require("./role_commands/knight_commands");
const {
	setupNobleBotEvents,
	messageNobleCommands,
} = require("./role_commands/noble_commands");
const {
	setupLordBotEvents,
	messageLordCommands,
} = require("./role_commands/lord_commands");
const {
	setupKingBotEvents,
	messageKingCommands,
} = require("./role_commands/king_commands");
const {
	setupEmperorBotEvents,
	messageEmperorCommands,
} = require("./role_commands/emperor_commands");

async function createBot(token, channelId, setupEventsFunction, messageCommands, isConsole) {
	const client = isConsole ? 
		new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.MessageContent,
			],
		}):
		new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMembers,
			],
		});
	await new Promise((resolve, reject) => {
		client.once("ready", async () => {
			try{
				// Fetch the channel and delete all previous messages
				const channel = client.channels.cache.get(channelId);
				if (!channel) {
					console.error(`Failed to fetch channel with ID: ${channelId}`);
					return;
				}
				let shouldContinue = true;
				while (shouldContinue) {
					const messages = await channel.messages.fetch({ limit: 1 });
					const botMessages = messages.filter(
						(msg) => msg.author.id === client.user.id
					);
					if (botMessages.size === 0) {
						shouldContinue = false;
						console.log(`${client.user.tag}: No more messages to delete.`);
						break;
					}

					for (const message of botMessages.values()) {
						await message.delete().catch(console.error);
					}

					// Safety delay to respect rate limits - adjust as needed
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
				const sentMessage = await messageCommands(client);
				let lastMessageId = sentMessage.id;
				await setupEventsFunction(client, lastMessageId);
				if(isConsole){
					eventEmitter.emit("startXpBoost&RevolutonStates");
				}
				resolve();
			} catch (err) {
				console.error(err);
				reject(err);
			}
		});

		client.login(token);
	});
	return client;
}


async function initializeBots() {
	const clients = [];
	
	clients.push(await createBot(
		process.env.TOKEN_EMPEROR,
		process.env.CHANNELIDEMPEROR,
		setupEmperorBotEvents,
		messageEmperorCommands
	));
	

	clients.push(await createBot(
		process.env.TOKEN_POOP,
		process.env.CHANNELIDPOOP,
		setupPoopBotEvents,
		messagePoopCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_MAGGOT,
		process.env.CHANNELIDMAGGOT,
		setupMaggotBotEvents,
		messageMaggotCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_COCKROACH,
		process.env.CHANNELIDCOCKROACH,
		setupCockroachBotEvents,
		messageCockroachCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_RAT,
		process.env.CHANNELIDRAT,
		setupRatBotEvents,
		messageRatCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_SUBHUMAN,
		process.env.CHANNELIDSUBHUMAN,
		setupSubhumanBotEvents,
		messageSubhumanCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_PEASANT,
		process.env.CHANNELIDPEASANT,
		setupPeasantBotEvents,
		messagePeasantCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_MERCHANT,
		process.env.CHANNELIDMERCHANT,
		setupMerchantBotEvents,
		messageMerchantCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_SCHOLAR,
		process.env.CHANNELIDSCHOLAR,
		setupScholarBotEvents,
		messageScholarCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_KNIGHT,
		process.env.CHANNELIDKNIGHT,
		setupKnightBotEvents,
		messageKnightCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_NOBLE,
		process.env.CHANNELIDNOBLE,
		setupNobleBotEvents,
		messageNobleCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_LORD,
		process.env.CHANNELIDLORD,
		setupLordBotEvents,
		messageLordCommands
	));
	clients.push(await createBot(
		process.env.TOKEN_KING,
		process.env.CHANNELIDKING,
		setupKingBotEvents,
		messageKingCommands
	));
	
	clients.push(await createBot(
		process.env.TOKEN_CONSOLE,
		process.env.CHANNELIDCONSOLE,
		setupConsoleBotEvents,
		messageConsoleCommands,
		true
	));
	gameState.setServerDown(false);
	eventEmitter.emit("ServerStatusChange");
	return clients;

}

module.exports = { initializeBots };
