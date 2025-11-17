const {eventEmitter} = require('../functions/eventEmitter.js');
const gameState = require("../game_state.js");
const {
	RoleChangeMessageDisplayTime,
	TextPoopMessageContent
} = require('../game_config.json');

const content = TextPoopMessageContent;

function showErrorMsg(err) {
	console.error("ERROR: poop_commands.js", err);
}

async function setupPoopBotEvents(client, lastMessageId) {	
	eventEmitter.on('Death', async (deadMessage) => {
		try {
			channel = await client.channels.fetch(process.env.CHANNELID_CESSPIT);
		} catch (err) {
			return showErrorMsg(err);
		}
		const message = await channel.send({
			content: `${deadMessage}\n Hit the gutter. \n`,
		});
	});
	eventEmitter.on('InfanticideComplete', async (maggotToMessage, cockroachUsername) => {
		let channel = null;
		try {
			channel = await client.channels.fetch(process.env.CHANNELID_CESSPIT);
		} catch (err) {
			return showErrorMsg(err);
		}
		const message = await channel.send({
			content: `${maggotToMessage} was devoured as brood by ${cockroachUsername}...\n
			Hit the gutter. \n`,
		});
	});

	eventEmitter.on('notifyFesterTarget', async (poopUsername) => {
		let channel = null;
		try {
			channel = await client.channels.fetch(process.env.CHANNELID_CESSPIT);
		} catch (err) {
			return showErrorMsg(err);
		}
		const message = await channel.send({
			content: `half of  ${poopUsername}'s drops will be siphoned for a while...\n`,
		});
	});

	eventEmitter.on("NibbleComplete", async (poopUserName, ratUserName) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELID_CESSPIT);
			const message = await channel.send({
				content: `${poopUserName} was devoured in their early years by ${ratUserName}...\n Hit the gutter. \n`,
			});
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("DepravityComplete", async (targetUsername, subhumanUsername) =>{
		try{
			let channel = await client.channels.fetch(process.env.CHANNELID_CESSPIT);
			const message = await channel.send({
				content: `${targetUsername} was eaten by his own kind,${subhumanUsername}...\n Hit the gutter. \n`,
			});

		}catch(err){
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ManhuntComplete", async(targetUsername, subhumanUsername)=>{
		try{
			let channel = await client.channels.fetch(process.env.CHANNELID_CESSPIT);
			const message = await channel.send({
				content: `${targetUsername}, a lowly peasant, was killed by ${subhumanUsername} in rabid rage...\n Hit the gutter. \n`,
			});

		}catch(err){
			showErrorMsg(err);
		}
	});
	eventEmitter.on("PickingComplete", async(targetUsername, subhumanUsername)=>{
		try{
			let channel = await client.channels.fetch(process.env.CHANNELID_CESSPIT);
			const message = await channel.send({
				content: `${targetUsername} was eaten by ${subhumanUsername}, disgusting...\n Hit the gutter. \n`,
			});
	
		}catch(err){
			showErrorMsg(err);
		}
	});
	eventEmitter.on('ServerStatusChange', async () => {
		try{
			await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});

}
async function updateMessage(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDPOOP);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";

		await messageToEdit.edit({
				content: serverText + '\n' + content,
			});
	} catch (err) {
		showErrorMsg(err);
	}
}
async function messagePoopCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDPOOP);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		return await channel.send({content: serverText + '\n' + content}); // message
	} catch (err) {
		return showErrorMsg(err);
	}
}

module.exports = {setupPoopBotEvents, messagePoopCommands};

