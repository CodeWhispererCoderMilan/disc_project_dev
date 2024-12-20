const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
} = require("discord.js");
const {
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
	ButtonLabelInfanticide
} = require(`../game_config.json`);
const { buildSelectMenu } = require(`../functions/botActions.js`);
const { DBUpdateXP } = require("../apis/firebase/querys.js");
const { eventEmitter } = require("../functions/eventEmitter.js");

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

async function setupCockroachBotEvents(client, lastMessageId) {
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
						if (newMember.id === swarmInitiatorId) {
							// If the initiator lost the role, reset the swarm
							const initiatorUsername = swarmInitiatorUsername;
							await resetSwarm(client, lastMessageId);
							await client.emit("SwarmInitiatorRoleChanged", initiatorUsername);
						} else {
							// Update the swarm count
							if (swarmInLastPhase) {
								await resetSwarm(client, lastMessageId);
								await client.emit(
									"SwarmParticipantDied",
									newMember.user.username
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
			if(swarmTargetId === oldMember.id && lastMessageId){
				client.emit("SwarmTargetChangedRoles", oldMember.user.username);	
				resetSwarm(client, lastMessageId);
			}
		}

	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
		if (interaction.customId === "selectMaggot") {
			const userId = interaction.user.id;
			let selectedMaggotId = interaction.values[0];
			try {
				selectedMaggots[userId] = await interaction.guild.members.cache.get(
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
				selectedSubhumans[userId] = await interaction.guild.members.cache.get(
					selectedSubhumanId
				);
				await interaction.deferUpdate();
			} catch (err) {
				console.error(err);
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
						await resetSwarm(client, messageToEdit, content);
					}
				}, SwarmVoteTime);

				await interaction.reply({
					content: `Swarm initiated, ${SwarmThreshold - 1} other cockroaches must join for it to spawn...`,
					ephemeral: true,
				});
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
						if (swarmParticipants.size === SwarmThreshold && swarmActive) {
							const subhumanId = selectedSubhumans[swarmInitiatorId].id;
							const subhumanMember = await interaction.guild.members.fetch(
								subhumanId
							);
							eventEmitter.emit("changeRole", subhumanMember, "Poop", false);
							eventEmitter.emit(
								"SwarmComplete",
								selectedSubhumans[swarmInitiatorId].user.username,
								swarmInitiatorUsername
							);
							await CacheSetSwarmCooldown(Date.now());
							await resetSwarm(client, lastMessageId);
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
						content: `Not enough XP (current XP: ${userXP})`,
						ephemeral: true,
					});
				} catch (err) {
					console.error(err);
					throw err;
				}
			} else {
				if (!selectedMaggots[userId])
					throw { name: "NoMaggotSelected", message: "No maggot selected" };
				const cooldown = await CacheGetCooldown("infanticide", userId);
				if (cooldown) {
					try {
						await interaction.reply({
							content: "Infanticide is on cooldown and cannot be used",
							ephemeral: true,
						});
					} catch (err) {
						throw err;
					}
				} else {
					try {
						eventEmitter.emit("changeRole",selectedMaggots[userId],"Poop",false);
						await DBUpdateXP(userId, -InfanticideCost, client);
						await CacheSetCooldown("infanticide", userId, InfanticideCooldown);
					} catch (err) {
						console.error(err);
						throw err;
					}
					try {
						eventEmitter.emit(
							"InfanticideComplete",
							selectedMaggots[userId].user.username,
							interaction.user.username
						);
						const XPleft = parseInt(userXP) - parseInt(InfanticideCost);
						await interaction.reply({
							content: `(${XPleft} XP left) Infanticide committed
							successfully. ${selectedMaggots[userId].user.username} has 
							been reduced to poop`,
							ephemeral: true,
						});
					} catch (err) {
						console.error(err);
						throw err;
					}
					selectedMaggots[userId] = null;
				}
			}
		}
	});

	client.on("SwarmInitiatorRoleChanged", async (username) => {
		try {
			const channel = await client.channels.fetch(
				process.env.CHANNELIDCOCKROACH
			);
			const tempMessage = await channel.send(
				`Swarm failed! The initiator ${username} is no longer a cockroach.`
			);
			// Delete the message after 30 seconds
			setTimeout(() => {
				tempMessage.delete().catch(console.error);
			}, 30000);
		} catch (err) {
			throw err;
		}
	});
	client.on("SwarmParticipantDied", async (username) => {
		try {
			const channel = await client.channels.fetch(
				process.env.CHANNELIDCOCKROACH
			);
			const tempMessage = await channel.send(
				`Swarm failed! ${username} is no longer a cockroach.`
			);
			// Delete the message after 30 seconds
			setTimeout(() => {
				tempMessage.delete().catch(console.error);
			}, 30000);
		} catch (err) {
			throw err;
		}
	});
	client.on("SwarmTargetChangedRoles", async (username) => {
		try {
			const channel = await client.channels.fetch(
				process.env.CHANNELIDCOCKROACH
			);
			const tempMessage = await channel.send(
				`Swarm failed! ${username} is no longer Sub-human.`
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
		async (subHumanUsername, initiatorUsername) => {
			try {
				const channel = await client.channels.fetch(
					process.env.CHANNELIDCOCKROACH
				);
				const tempMessage = await channel.send(`
					Swarm successful! ${subHumanUsername} was consumed by ${initiatorUsername}'s spawn.`);

				// Delete the message after 30 seconds
				setTimeout(() => {
					tempMessage.delete().catch(console.error);
				}, 30000);
			} catch (err) {
				throw err;
			}
		}
	);
}

async function updateMessage(client, lastMessageId){
	try {
		const channel = await client.channels.fetch(
			process.env.CHANNELIDCOCKROACH
		);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		if(!swarmActive){
			const selectMenuMaggots = await buildSelectMenu(
				client,
				["maggot"],
				"selectMaggot",
				TextInfanticideSelectMenu
			);
			const selectMenuSubhumans = await buildSelectMenu(
				client,
				["subhuman"],
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
				.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
				.setCustomId("swarmInitiated")
				.setLabel(ButtonLabelSwarm)
				.setStyle(ButtonStyle.Primary)
			);

			await messageToEdit.edit({
				content: content,
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
				.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
				.setCustomId("joinSwarm")
				.setLabel(ButtonLabelSwarm)
				.setStyle(ButtonStyle.Primary)
			);


			const actionRow_2 = ActionRowBuilder.from(
				buttonRow
			);


			const swarmVote_content =
				content +
				`\n@${swarmInitiatorUsername} initiated a swarm (${swarmParticipants.size}/${SwarmThreshold})`;
			await messageToEdit.edit({
				content: swarmVote_content,
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
				.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
				.setCustomId("joinSwarm")
				.setLabel(ButtonLabelSwarm)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(true)
			);

			const actionRow_2 = ActionRowBuilder.from(
				buttonRow
			);


			await messageToEdit.edit({
				content:content + `\n${SwarmThreshold} cockroaches gathered, the swarm is burrowing...`,
				components: [actionRow_0, actionRow_1, actionRow_2],
			});

		}	
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

	try {
		const selectMenuMaggots = await buildSelectMenu(
			client,
			["maggot"],
			"selectMaggot",
			TextInfanticideSelectMenu
		);
		const selectMenuSubhumans = await buildSelectMenu(
			client,
			["subhuman"],
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
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("swarmInitiated")
			.setLabel("swarm")
			.setStyle(ButtonStyle.Primary)
		);

		const message = await channel.send({
			content:TextCockroachMessageContent,
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
