const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
} = require("discord.js");
const {
	CacheGetUsersByRoles,
	CacheGetCooldown,
	CacheSetCooldown,
	CacheGetUserXP,
	CacheGetSwarmCooldown,
	CacheSetSwarmCooldown,
} = require("../apis/redis/redisCache");
const {
	InfanticideCost,
	InfanticideCooldown,
	SwarmVoteTime,
	SwarmSpawnTime,
	SwarmThreshold,
	TextSwarmSelectMenu,
	TextInfanticideSelectMenu,
	TextCockroachMessageContent,
	ButtonLabelSwarm,
	ButtonLabelInfanticide,
	ButtonLabelJoinSwarm
} = require(`../game_config.json`);
const { buildSelectMenu } = require(`../functions/botActions.js`);
const { DBUpdateXP, changeRole } = require("../apis/firebase/querys.js");
const { eventEmitter } = require("../functions/eventEmitter.js");
const gameState = require("../game_state.js");
const content = TextCockroachMessageContent;
const selectedMaggots = {};
let selectedSubhumans = {};
let swarmInitiatorId = null;
let swarmInitiatorUsername = null;
let swarmTargetId = null;
let swarmTargetUsername = null;
let swarmActive = false;
let swarmInLastPhase = false;
let swarmParticipants = new Set();
function showErrorMsg(err) {
	console.error("ERROR: cockroach_commands.js", err);
}
async function setupCockroachBotEvents(client, lastMessageId) {
	client.on("guildMemberRemove", async (member) => {
		try {
			const hadRoleBeforeMaggot = member.roles.cache.has(
				process.env.ROLEID_MAGGOT
			);
			const hadRoleBeforeCockroach = member.roles.cache.has(
				process.env.ROLEID_COCKROACH
			);
			const hadRoleBeforeSubHuman = member.roles.cache.has(
				process.env.ROLEID_SUBHUMAN
			);
			if(hadRoleBeforeMaggot){
				for (let userId in selectedMaggots) {
					if (selectedMaggots[userId] && selectedMaggots[userId].id === member.id) {
						delete selectedMaggots[userId];
						console.log(`Removed ${member.user.username} from selected 
							Maggots for infanticide`);
					}
				}			
				if (lastMessageId) {
					try {
						updateMessage(client,lastMessageId);
					} catch (err) {
						console.error(err);
					}
				}
			}
			if(hadRoleBeforeCockroach){
				if(selectedSubhumans[member.id]) delete selectedSubhumans[member.id];
				if (swarmActive && swarmParticipants.has(member.id)) {
					swarmParticipants.delete(member.id);
			
						if (member.id === swarmInitiatorId && swarmActive) {
							await resetSwarm(client, lastMessageId);
							await swarmFailureNotification(client, member.id);
							client.emit("SwarmInitiatorRoleChanged", member.id);
						} else {
							// Update the swarm count
							if (swarmInLastPhase && swarmActive) {
								const swarmInitId = swarmInitiatorId;
								await resetSwarm(client, lastMessageId);
								await swarmFailureNotification(client, swarmInitId);
								client.emit(
									"SwarmParticipantDied",
									member.id
								);
							} else {
								await updateMessage(client, lastMessageId);
							}
						}
					}
			}
			// Update select menus if member was potential target
			if (hadRoleBeforeSubHuman) {
				for (let userId in selectedSubhumans) {
					if (selectedSubhumans[userId] && selectedSubhumans[userId].id === member.id) {
						delete selectedSubhumans[userId];
					}
				}
				if(swarmActive && swarmTargetId === member.id && lastMessageId){
					client.emit("SwarmTargetChangedRoles", member.id);
					const initId = swarmInitiatorId;
					await resetSwarm(client, lastMessageId);
					await swarmFailureNotification(client, initId);
				}else if(!swarmActive){
					await updateMessage(client, lastMessageId);
				}
			}
		} catch (err) {
			showErrorMsg(err);
		}
	});
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const hadRoleBeforeMaggot = oldMember.roles.cache.has(process.env.ROLEID_MAGGOT);
		const hasRoleNowMaggot = newMember.roles.cache.has(process.env.ROLEID_MAGGOT);
		const hadRoleBeforeSubHuman = oldMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hasRoleNowSubhuman = newMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hadRoleBeforeCockroach = oldMember.roles.cache.has(
			process.env.ROLEID_COCKROACH
		);
		const hasRoleNowCockroach = newMember.roles.cache.has(
			process.env.ROLEID_COCKROACH
		);
		if (hadRoleBeforeCockroach && !hasRoleNowCockroach) {
			selectedSubhumans[newMember.id] = null;
			if(swarmActive){
				if (swarmParticipants.has(newMember.id)) {
					try {
						swarmParticipants.delete(newMember.id);
						if (newMember.id === swarmInitiatorId && swarmActive) {
							await resetSwarm(client, lastMessageId);
							await swarmFailureNotification(client, newMember.id);
							client.emit("SwarmInitiatorRoleChanged", newMember.id);
						} else {
							// Update the swarm count
							if (swarmInLastPhase && swarmActive) {
								const initiatorId = swarmInitiatorId;
								await resetSwarm(client, lastMessageId);
								await swarmFailureNotification(client, initiatorId);
								client.emit(
									"SwarmParticipantDied",
									newMember.id
								);
							} else {
								await updateMessage(client, lastMessageId);
							}
						}
					} catch (err) {
						throw err;
					}
				}
			}
		}

		if(hadRoleBeforeMaggot){
			for (let userId in selectedMaggots) {
				if (selectedMaggots[userId] && selectedMaggots[userId].id === oldMember.id) {
					delete selectedMaggots[userId];
					console.log(`Removed ${oldMember.user.username} from selected Maggots for infanticide`);
				}
			}

		}
		if(hadRoleBeforeSubHuman){
			for (let userId in selectedSubhumans) {
				if (selectedSubhumans[userId] && selectedSubhumans[userId].id === oldMember.id) {
					delete selectedSubhumans[userId];
					console.log(`Removed ${oldMember.user.username} from selected Subhumans for swarm`);
				}
			}
			if(swarmTargetId === oldMember.id && lastMessageId && swarmActive){
				client.emit("SwarmTargetChangedRoles", oldMember.id);	
				const initiatorId = swarmInitiatorId;
				await resetSwarm(client, lastMessageId);
				await swarmFailureNotification(client, initiatorId);
			}
		}
		if (hadRoleBeforeMaggot || hasRoleNowMaggot ) {
			if (lastMessageId) {
				try {
					updateMessage(client,lastMessageId);
				} catch (err) {
					console.error(err);
				}
			}
		}
		if (hadRoleBeforeSubHuman || hasRoleNowSubhuman ) {
			if (lastMessageId && !swarmActive) {
				try {
					updateMessage(client,lastMessageId);
				} catch (err) {
					console.error(err);
				}
			}
		}

	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
		if (interaction.customId === "selectMaggot") {
			const userId = interaction.user.id;
			let selectedMaggotId = interaction.values[0];
			try {
				selectedMaggots[userId] = await interaction.guild.members.fetch(
					selectedMaggotId
				);
				await interaction.deferUpdate();
			} catch (err) {
				console.error(err);
			}
		}
		if (interaction.customId === "selectSubhuman") {
			const userId = interaction.user.id;
			let selectedSubhumanId = interaction.values[0];
			try {
				await interaction.deferUpdate().catch((err) => {console.log(err);});
				selectedSubhumans[userId] = await interaction.guild.members.fetch(
					selectedSubhumanId
				);
			} catch (err) {
				console.log(err);
				throw err;
			}
		}
		if (interaction.customId === "swarmInitiated") {
			let cooldown;
			try {
				cooldown = await CacheGetSwarmCooldown();
			} catch (err) {
				throw err;
			}
			if (cooldown) {
				interaction.reply({
					content: "Swarm is on cooldown",
					ephemeral: true,
				});
				return;
			}
			const userId = interaction.user.id;
			if (!selectedSubhumans[userId]) {
				interaction.reply({
					content: "No sub-human selected",
					ephemeral: true,
				});
				return;
			}
			swarmInitiatorId = userId;
			swarmInitiatorUsername = interaction.user.username;
			swarmTargetId = selectedSubhumans[userId].id;
			swarmTargetUsername = selectedSubhumans[userId].user.username;
			swarmParticipants.add(userId);
			swarmActive = true;

			try {
				await updateMessage(client, lastMessageId);
				setTimeout(async () => {
					if (!swarmInLastPhase && swarmParticipants.size < SwarmThreshold && swarmActive) {
						const swarmInitId = swarmInitiatorId;
						await resetSwarm(client, lastMessageId, content);
						await swarmFailureNotificationInFlyCommands(client, swarmInitId);
						await swarmFailureNotification(client, swarmInitId);
					}
				}, SwarmVoteTime);

				await interaction.reply({
					content: `Swarm initiated, ${SwarmThreshold - 1} other flies must join for it to spawn...`,
					ephemeral: true,
				});
				await swarmStartNotification(client);
			} catch (err) {
				console.error(err);
			}
		}

		if (interaction.customId === "joinSwarm") {
			try {
				if (!swarmActive) {
					await interaction.reply({
						content: "There is no active swarm to join.",
						ephemeral: true,
					});
					return;
				}

				const userId = interaction.user.id;
				if (userId === swarmInitiatorId) {
					await interaction.reply({
						content: "You can't join your own swarm.",
						ephemeral: true,
					});
					return;
				}

				if (swarmParticipants.has(userId)) {
					await interaction.reply({
						content: "You've already joined this swarm.",
						ephemeral: true,
					});
					return;
				}
				if (swarmParticipants.size === SwarmThreshold) {
					await interaction.reply({
						content: "The swarm is full.",
						ephemeral: true,
					});
					return;
				}
				swarmParticipants.add(userId);

				if (swarmActive && swarmParticipants.size >= SwarmThreshold ) {
					swarmInLastPhase = true;
					await updateMessage(client, lastMessageId);
					setTimeout(async () => {
						if(!swarmActive) return;
						if (swarmParticipants.size === SwarmThreshold) {
							const subhumanMember = selectedSubhumans[swarmInitiatorId];
							const initiatorId = swarmInitiatorId;
							const swarmSize = swarmParticipants.size.toString();
							await CacheSetSwarmCooldown(Date.now());
							await resetSwarm(client, lastMessageId);
							await changeRole( subhumanMember, "Poop", false);
							eventEmitter.emit(
								"SwarmComplete",
								subhumanMember.id,
								initiatorId
							);

							await swarmSuccessNotification(
								client,
								subhumanMember.id,
								swarmSize
							);
							eventEmitter.emit("Death", `<@${subhumanMember.id}> was picked apart by a swarm of flies.`);
						}else{
							await CacheSetSwarmCooldown(Date.now());
							const initiatorId = swarmInitiatorId;
							await resetSwarm(client, lastMessageId);
							await swarmFailureNotificationInFlyCommands(client, initiatorId);
							await swarmFailureNotification(client, initiatorId);
						}
					}, SwarmSpawnTime);
					await interaction.reply({
						content: "Swarm vote successful! The swarm is spawning...",
						ephemeral: true,
					});
				} else{
					await updateMessage(client, lastMessageId);
					await interaction.reply({
						content: `You've joined the swarm! (${swarmParticipants.size}/${SwarmThreshold})`,
						ephemeral: true,
					});
				}
			} catch (err) {
				throw err;
			}
		}
		if (interaction.customId === "commitInfanticide") {
			const userId = interaction.user.id;
			const userXP = await CacheGetUserXP(userId);
			if (+userXP < +InfanticideCost) {
				try {
					await interaction.reply({
						content: `Not enough drops (current drops: ${userXP})`,
						ephemeral: true,
					});
					return;
				} catch (err) {
					console.error(err);
					throw err;
				}
			} 
			if (!selectedMaggots[userId]){
				await interaction.reply({
					content: `No Maggot selected for infanticide`,
					ephemeral: true,
				});
				return;
			}
			const cooldown = await CacheGetCooldown("infanticide", userId);
			if (cooldown) {
				try {
					await interaction.reply({
						content: "Infanticide is on cooldown and cannot be used",
						ephemeral: true,
					});
					return;
				} catch (err) {
					throw err;
				}
			}
			try {
				const interactionUserId = interaction.user.id;
				const maggotId = selectedMaggots[userId].id;
				await changeRole( selectedMaggots[userId],"Poop",false);
				await DBUpdateXP(userId, -InfanticideCost, client);
				await CacheSetCooldown("infanticide", userId, InfanticideCooldown);
				await infanticideNotification(client, interactionUserId, maggotId);

				eventEmitter.emit(
					"InfanticideComplete",
					maggotId,
					interactionUserId
				);
				const XPleft = parseInt(userXP) - parseInt(InfanticideCost);
				await interaction.reply({
					content: `(${XPleft} drops left) You've eaten your spawn. 
					<@${maggotId}> plummets to the cesspit...`,
					ephemeral: true,
				});
			} catch (err) {
				console.error(err);
				throw err;
			}
			selectedMaggots[userId] = null;

		}

	});

	client.on("SwarmInitiatorRoleChanged", async (id) => {
		try {
			const channel = await client.channels.fetch(
				process.env.CHANNELIDCOCKROACH
			);
			const tempMessage = await channel.send(
				`Swarm failed,the first fly, <@${id}> is no longer a fly.`
			);
			// Delete the message after 30 seconds
			setTimeout(() => {
				tempMessage.delete().catch(console.error);
			}, 30000);
		} catch (err) {
			throw err;
		}
	});
	client.on("SwarmParticipantDied", async (id) => {
		try {
			const channel = await client.channels.fetch(
				process.env.CHANNELIDCOCKROACH
			);
			const tempMessage = await channel.send(
				`Swarm failed, <@${id}> is no longer a fly.`
			);
			// Delete the message after 30 seconds
			setTimeout(() => {
				tempMessage.delete().catch(console.error);
			}, 30000);
		} catch (err) {
			throw err;
		}
	});
	client.on("SwarmTargetChangedRoles", async (id) => {
		try {
			const channel = await client.channels.fetch(
				process.env.CHANNELIDCOCKROACH
			);
			const tempMessage = await channel.send(
				`Swarm failed! <@${id}> is no longer Sub-human.`
			);
			// Delete the message after 30 seconds
			setTimeout(() => {
				tempMessage.delete().catch(console.error);
			}, 30000);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on(
		"SwarmComplete",
		async (subHumanId, initiatorId) => {
			try {
				const channel = await client.channels.fetch(
					process.env.CHANNELIDCOCKROACH
				);
				const tempMessage = await channel.send(`
					Swarm successful! <@${subHumanId}> was consumed by <@${initiatorId}>'s spawn.`);

				// Delete the message after 30 seconds
				setTimeout(() => {
					tempMessage.delete().catch(console.error);
				}, 30000);
			} catch (err) {
				throw err;
			}
		}
	);
	eventEmitter.on("ServerStatusChange", async () => {
		try{
			await updateMessage(client, lastMessageId);
		} catch(err){
			console.error(err);
		}
	});
}

async function updateMessage(client, lastMessageId){
	try {
		const channel = await client.channels.fetch(
			process.env.CHANNELIDCOCKROACH
		);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";

		if(!swarmActive){
			const selectMenuMaggots = await buildSelectMenu(
				client,
				["maggot"],
				"selectMaggot",
				TextInfanticideSelectMenu
			);
			const selectMenuSubhumans = await buildSelectMenu(
				client,
				["sub-human"],
				"selectSubhuman",
				TextSwarmSelectMenu
			);
			const row_maggot_select = new ActionRowBuilder().addComponents(
				selectMenuMaggots
			);
			const row_subhuman_select = new ActionRowBuilder().addComponents(
				selectMenuSubhumans
			);
			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("commitInfanticide")
				.setLabel(ButtonLabelInfanticide)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("swarmInitiated")
				.setLabel(ButtonLabelSwarm)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown())
			);

			await messageToEdit.edit({
				content: serverText+ '\n'  + content,
				components: [row_maggot_select, row_subhuman_select, buttonRow],
			});

		}else if(!swarmInLastPhase){
			const selectMenuMaggots = await buildSelectMenu(
				client,
				["maggot"],
				"selectMaggot",
				TextInfanticideSelectMenu
			);
			const actionRow_0 = new ActionRowBuilder().addComponents(
				selectMenuMaggots
			);
			const actionRow_1 = ActionRowBuilder.from(
				messageToEdit.components[1].toJSON()
			);
			const subhumanSelectMenu = StringSelectMenuBuilder.from(
				actionRow_1.components[0].toJSON()
			)
				.setDisabled(true)
				.setPlaceholder(swarmTargetUsername);
			actionRow_1.components[0] = subhumanSelectMenu;
			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("commitInfanticide")
				.setLabel(ButtonLabelInfanticide)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("joinSwarm")
				.setLabel(ButtonLabelJoinSwarm)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown())
			);


			const actionRow_2 = ActionRowBuilder.from(
				buttonRow
			);


			const swarmVote_content =
				content +
				`\n<@${swarmInitiatorId}> initiated a swarm (${swarmParticipants.size}/${SwarmThreshold})`;
			await messageToEdit.edit({
				content: serverText+ '\n'  + swarmVote_content,
				components: [actionRow_0, actionRow_1, actionRow_2],
			});

		}else{
			const selectMenuMaggots = await buildSelectMenu(
				client,
				["maggot"],
				"selectMaggot",
				TextInfanticideSelectMenu
			);
			const actionRow_0 = new ActionRowBuilder().addComponents(
				selectMenuMaggots
			);
			const actionRow_1 = ActionRowBuilder.from(
				messageToEdit.components[1].toJSON()
			);
			const subhumanSelectMenu = StringSelectMenuBuilder.from(
				actionRow_1.components[0].toJSON()
			)
				.setDisabled(true)
				.setPlaceholder(swarmTargetUsername);
			actionRow_1.components[0] = subhumanSelectMenu;
			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("commitInfanticide")
				.setLabel(ButtonLabelInfanticide)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("joinSwarm")
				.setLabel(ButtonLabelJoinSwarm)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(true)
			);

			const actionRow_2 = ActionRowBuilder.from(
				buttonRow
			);


			await messageToEdit.edit({
				content:serverText + '\n' + content + `\n${SwarmThreshold} flies gathered, the swarm is burrowing...`,
				components: [actionRow_0, actionRow_1, actionRow_2],
			});

		}	
	} catch (err) {
		throw err;
	}

}
async function infanticideNotification (client, flyId, maggotId){
	try {
		const putridWasteChannel = await client.channels.fetch(process.env.CHANNELID_PUTRID_WASTE);
		await putridWasteChannel.send(`<@${flyId}> ate <@${maggotId}> in bitter infanticide.`);
	} catch (err) {
		showErrorMsg(err);
	}
}
async function swarmStartNotification (client){
	try {
		const putridWasteChannel = await client.channels.fetch(process.env.CHANNELID_PUTRID_WASTE);
		await putridWasteChannel.send(`swaths of flies are gathering...`);
	} catch (err) {
		showErrorMsg(err);
	}
}
async  function swarmSuccessNotification (client, subhumanId, swarmCount){
	try {
		const putridWasteChannel = await client.channels.fetch(process.env.CHANNELID_PUTRID_WASTE);
		await putridWasteChannel.send(`<@${subhumanId}> was picked apart by ${swarmCount} swarming flies.`);
	} catch (err) {
		showErrorMsg(err);
	}
}
async function swarmFailureNotification (client, swarmInitId){
	try {
		const putridWasteChannel = await client.channels.fetch(process.env.CHANNELID_PUTRID_WASTE);
		await putridWasteChannel.send(`<@${swarmInitId}>'s swarm has failed, dim-witted fly...`);
	} catch (err) {
		showErrorMsg(err);
	}
}
async function swarmFailureNotificationInFlyCommands (client, swarmInitId){
	try {
		const channel = await client.channels.fetch(
			process.env.CHANNELIDCOCKROACH
		);
		const tempMessage = await channel.send(`<@${swarmInitId}> swarm failed, the little flies he gathered glide away...`);

		// Delete the message after 30 seconds
		setTimeout(() => {
			tempMessage.delete().catch(console.error);
		}, 30000);
	} catch (err) {
		throw err;
	}
}
async function messageCockroachCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDCOCKROACH);
	} catch (err) {
		console.error(err);
		return;
	}
	const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
	try {
		const selectMenuMaggots = await buildSelectMenu(
			client,
			["maggot"],
			"selectMaggot",
			TextInfanticideSelectMenu
		);
		const selectMenuSubhumans = await buildSelectMenu(
			client,
			["sub-human"],
			"selectSubhuman",
			TextSwarmSelectMenu
		);
		const row_maggot_select = new ActionRowBuilder().addComponents(
			selectMenuMaggots
		);
		const row_subhuman_select = new ActionRowBuilder().addComponents(
			selectMenuSubhumans
		);
		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("commitInfanticide")
			.setLabel("Infanticide")
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("swarmInitiated")
			.setLabel("swarm")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown())
		);

		const message = await channel.send({
			content: serverText+ '\n'  + TextCockroachMessageContent,
			components: [row_maggot_select, row_subhuman_select, buttonRow],
		});
		return message;
	} catch (err) {
		throw err;
	}
}

async function resetSwarm(client, lastMessageId) {
	try {
		swarmInLastPhase = false;
		swarmActive = false;
		swarmInitiatorUsername = null;
		selectedSubhumans = {};
		swarmTargetId = null;
		swarmTargetUsername = null;
		swarmInitiatorId = null;
		swarmParticipants.clear();
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

module.exports = { setupCockroachBotEvents, messageCockroachCommands };
