jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
	CacheGetCooldown: jest.fn().mockResolvedValue(null),
	CacheSetCooldown: jest.fn().mockResolvedValue(),
	CacheGetUserXP: jest.fn().mockResolvedValue(1000),
	CacheSetEndow: jest.fn().mockResolvedValue(),
	CacheClearTargetEndows: jest.fn().mockResolvedValue(),
	CacheClearMerchantEndows: jest.fn().mockResolvedValue(),
	CacheCheckEndowExists: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../apis/firebase/querys.js', () => ({
	DBUpdateXP: jest.fn().mockResolvedValue(),
	changeRole: jest.fn().mockResolvedValue(),
}));

jest.mock('../../game_config.json', () => ({
	BribeCooldown: 120000,
	RoleChangeMessageDisplayTime: 5000,
	EndowDuration: 3600000,
	EndowCost: 100,
	EndowCooldown: 120000,
	TextMerchantMessageContent: 'merchant content',
	TextRevolutionTargetSelectMenu: 'Select revolution target',
	TextEmperorCandidateSelectMenu: 'Select emperor candidate',
	ButtonLabelRevolution: 'Revolution',
	ButtonLabelJoinRevolution: 'Join Revolution',
	ButtonLabelWithdrawRevolution: 'Withdraw',
	ButtonLabelVoteEmperor: 'Vote Emperor',
	ButtonLabelBribe: 'Bribe',
	ButtonLabelEndow: 'Endow',
	TextEndowSelectmenu: 'Select endow target',
	TextBribeSelectMenu: 'Select bribe target',
}));

jest.mock('../../functions/botActions.js', () => ({
	buildSelectMenu: jest.fn().mockResolvedValue({
		setCustomId: jest.fn().mockReturnThis(),
		setPlaceholder: jest.fn().mockReturnThis(),
		setDisabled: jest.fn().mockReturnThis(),
		addOptions: jest.fn().mockReturnThis(),
		toJSON: jest.fn().mockReturnValue({}),
	}),
	sendInteractionReply: jest.fn().mockResolvedValue(),
	messageChannel: jest.fn().mockResolvedValue(),
	messageAllHumanChannels: jest.fn().mockResolvedValue(),
}));

jest.mock('../../functions/eventEmitter.js', () => ({
	eventEmitter: { emit: jest.fn(), on: jest.fn() },
}));

jest.mock('../../game_state.js', () => ({
	isRevolutionActive: jest.fn().mockReturnValue(false),
	isCoupActive: jest.fn().mockReturnValue(false),
	isEmperorElectionActive: jest.fn().mockReturnValue(false),
	isRevolutionParticipant: jest.fn().mockReturnValue(false),
	isRevolutionSecondPhase: jest.fn().mockReturnValue(false),
	isReelectionActive: jest.fn().mockReturnValue(false),
	getDisableRevolution: jest.fn().mockReturnValue(false),
	isServerDown: jest.fn().mockReturnValue(false),
	getRevolutionarySize: jest.fn().mockReturnValue(0),
	getPeopleSize: jest.fn().mockReturnValue(0),
}));

jest.mock('discord.js', () => {
	function mockMenu() {
		return {
			setCustomId: jest.fn().mockReturnThis(),
			setPlaceholder: jest.fn().mockReturnThis(),
			setDisabled: jest.fn().mockReturnThis(),
			addOptions: jest.fn().mockReturnThis(),
			toJSON: jest.fn().mockReturnValue({}),
		};
	}
	function mockRow() {
		return {
			addComponents: jest.fn().mockReturnThis(),
			toJSON: jest.fn().mockReturnValue({ components: [{ toJSON: () => ({}) }] }),
			components: [mockMenu()],
		};
	}
	function mockButton() {
		return {
			setCustomId: jest.fn().mockReturnThis(),
			setLabel: jest.fn().mockReturnThis(),
			setStyle: jest.fn().mockReturnThis(),
			setDisabled: jest.fn().mockReturnThis(),
		};
	}
	const MockActionRowBuilder = jest.fn().mockImplementation(() => mockRow());
	MockActionRowBuilder.from = jest.fn().mockImplementation(() => mockRow());
	const MockStringSelectMenuBuilder = jest.fn().mockImplementation(() => mockMenu());
	MockStringSelectMenuBuilder.from = jest.fn().mockImplementation(() => mockMenu());
	return {
		ActionRowBuilder: MockActionRowBuilder,
		StringSelectMenuBuilder: MockStringSelectMenuBuilder,
		ButtonBuilder: jest.fn().mockImplementation(() => mockButton()),
		ButtonStyle: { Danger: 4, Primary: 1, Secondary: 2 },
		MessageFlags: { Ephemeral: 64 },
		ModalBuilder: jest.fn().mockImplementation(() => ({
			setCustomId: jest.fn().mockReturnThis(),
			setTitle: jest.fn().mockReturnThis(),
			addComponents: jest.fn().mockReturnThis(),
		})),
		TextInputBuilder: jest.fn().mockImplementation(() => ({
			setCustomId: jest.fn().mockReturnThis(),
			setLabel: jest.fn().mockReturnThis(),
			setStyle: jest.fn().mockReturnThis(),
			setPlaceholder: jest.fn().mockReturnThis(),
			setRequired: jest.fn().mockReturnThis(),
		})),
		TextInputStyle: { Short: 1, Paragraph: 2 },
	};
});

function makeMockClient() {
	const mockMsg = {
		edit: jest.fn().mockResolvedValue({}),
		components: Array(4).fill(null).map(() => ({
			toJSON: () => ({ components: [{ toJSON: () => ({}) }] }),
		})),
	};
	const mockChannel = {
		send: jest.fn().mockResolvedValue({ delete: jest.fn().mockResolvedValue() }),
		messages: { fetch: jest.fn().mockResolvedValue(mockMsg) },
	};
	const handlers = {};
	const client = {
		on: jest.fn((event, fn) => { handlers[event] = fn; }),
		emit: jest.fn((event, ...args) => { if (handlers[event]) handlers[event](...args); }),
		channels: { fetch: jest.fn().mockResolvedValue(mockChannel) },
		guilds: { fetch: jest.fn().mockResolvedValue({}) },
	};
	return { client, handlers, mockChannel };
}

function makeInteraction(customId, opts = {}) {
	const fetchedMember = opts.fetchedMember || {
		id: opts.targetId || 'target-1',
		user: { username: 'TargetUser', id: opts.targetId || 'target-1' },
		roles: { cache: { has: jest.fn().mockReturnValue(false) } },
	};
	return {
		customId,
		user: { id: opts.userId || 'user-1', username: opts.username || 'TestUser' },
		replied: false,
		deferred: false,
		reply: jest.fn().mockResolvedValue({}),
		deferUpdate: jest.fn().mockResolvedValue({}),
		deferReply: jest.fn().mockResolvedValue({}),
		followUp: jest.fn().mockResolvedValue({}),
		showModal: jest.fn().mockResolvedValue({}),
		values: opts.values || ['target-1'],
		fields: {
			getTextInputValue: jest.fn().mockImplementation((key) => opts.fields?.[key] ?? ''),
		},
		guild: { members: { fetch: jest.fn().mockResolvedValue(fetchedMember) } },
		isStringSelectMenu: () => opts.isSelect === true,
		isButton: () => opts.isSelect !== true && opts.isModal !== true,
		isModalSubmit: () => opts.isModal === true,
	};
}

describe('merchant_commands interactions', () => {
	let setupMerchantBotEvents;
	let CacheGetCooldown;
	let CacheSetCooldown;
	let CacheGetUserXP;
	let CacheSetEndow;
	let CacheCheckEndowExists;
	let DBUpdateXP;
	let sendInteractionReply;
	let messageChannel;
	let eventEmitter;
	let gameState;
	let handlers;
	let client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupMerchantBotEvents } = require('../../role_commands/merchant_commands'));
		({
			CacheGetCooldown,
			CacheSetCooldown,
			CacheGetUserXP,
			CacheSetEndow,
			CacheCheckEndowExists,
		} = require('../../apis/redis/redisCache'));
		({ DBUpdateXP } = require('../../apis/firebase/querys.js'));
		({ sendInteractionReply, messageChannel } = require('../../functions/botActions.js'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));
		gameState = require('../../game_state.js');

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;

		setupMerchantBotEvents(client, 'msg-id');
	});

	describe('BribeSelectMenu', () => {
		test('defers update and fetches selected member', async () => {
			const interaction = makeInteraction('BribeSelectMenu', {
				isSelect: true,
				values: ['bribe-target-1'],
			});
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('bribe-target-1');
		});
	});

	describe('EndowSelectMenu', () => {
		test('defers update and fetches selected member', async () => {
			const interaction = makeInteraction('EndowSelectMenu', {
				isSelect: true,
				values: ['endow-target-1'],
			});
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('endow-target-1');
		});
	});

	describe('SelectRevolutionTarget', () => {
		test('defers update and fetches selected member', async () => {
			const interaction = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				values: ['rev-target-1'],
			});
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('rev-target-1');
		});
	});

	describe('SelectEmperorCandidate', () => {
		test('defers update and fetches selected member', async () => {
			const interaction = makeInteraction('SelectEmperorCandidate', {
				isSelect: true,
				values: ['candidate-1'],
			});
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('candidate-1');
		});
	});

	describe('Endow button', () => {
		test('replies with error when no endow target selected', async () => {
			const interaction = makeInteraction('Endow', { userId: 'new-user' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Choose a member to endow'
			);
		});

		test('blocks self-targeting', async () => {
			const sel = makeInteraction('EndowSelectMenu', {
				isSelect: true,
				userId: 'user-1',
				values: ['user-1'],
				fetchedMember: {
					id: 'user-1',
					user: { id: 'user-1', username: 'TestUser' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Endow', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You cannot endow yourself!'
			);
		});

		test('replies with cooldown message when endow is on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(120000);
			const sel = makeInteraction('EndowSelectMenu', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Endow', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Endow is on cooldown'
			);
		});

		test('replies with not enough drops when XP is below cost', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUserXP.mockResolvedValue(50); // below EndowCost of 100
			const sel = makeInteraction('EndowSelectMenu', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Endow', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with already endowed message when endow already exists', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUserXP.mockResolvedValue(1000);
			CacheCheckEndowExists.mockResolvedValue(true);
			const sel = makeInteraction('EndowSelectMenu', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Endow', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You have already endowed this target!'
			);
		});

		test('successfully endows target: sets endow, deducts XP, sets cooldown, sends reply', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUserXP.mockResolvedValue(1000);
			CacheCheckEndowExists.mockResolvedValue(false);
			const sel = makeInteraction('EndowSelectMenu', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Endow', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(CacheSetEndow).toHaveBeenCalled();
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', 100, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('Endow', 'user-1', 120000);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('Successfully endowed')
			);
		});
	});

	describe('Bribe button', () => {
		test('replies with error when no bribe target selected', async () => {
			const interaction = makeInteraction('Bribe', { userId: 'new-user' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Choose a member'
			);
		});

		test('blocks self-targeting', async () => {
			const sel = makeInteraction('BribeSelectMenu', {
				isSelect: true,
				userId: 'user-1',
				values: ['user-1'],
				fetchedMember: {
					id: 'user-1',
					user: { id: 'user-1', username: 'TestUser' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Bribe', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You cannot target yourself!'
			);
		});

		test('replies with cooldown message when bribe is on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(120000);
			const sel = makeInteraction('BribeSelectMenu', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Bribe', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Bribe is on cooldown'
			);
		});

		test('shows modal when target selected and not on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			const sel = makeInteraction('BribeSelectMenu', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Bribe', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(interaction.showModal).toHaveBeenCalled();
		});
	});

	describe('Revolution button', () => {
		test('replies with already active message when revolution is active', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Revolution is already active'
			);
		});

		test('replies with no member selected when no target chosen', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('Revolution', { userId: 'new-user' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'No member selected'
			);
		});

		test('replies with cooldown message when revolution is on cooldown', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(120000);
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Revolution is on cooldown'
			);
		});

		test('blocks self-targeting', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(null);
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['user-1'],
				fetchedMember: {
					id: 'user-1',
					user: { id: 'user-1', username: 'TestUser' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You cannot target yourself.'
			);
		});

		test('emits StartRevolution and sends confirmation on success', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(null);
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(eventEmitter.emit).toHaveBeenCalledWith('StartRevolution', 'user-1', 'target-2', 'Merchant');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Revolution started, waiting for others to join.'
			);
		});
	});

	describe('JoinRevolution button', () => {
		test('replies with no revolution ongoing when revolution is not active', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('No revolution ongoing')
			);
		});

		test('replies with no member selected when no target chosen', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			const interaction = makeInteraction('JoinRevolution', { userId: 'new-user' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'No member selected'
			);
		});

		test('replies with already joined message when already a participant', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				"You've already joined revolution."
			);
		});

		test('emits AddRevolutionParticipant and sends confirmation on success', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['target-2'],
				fetchedMember: {
					id: 'target-2',
					user: { id: 'target-2', username: 'Target' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				'AddRevolutionParticipant',
				'Merchant',
				'user-1',
				'target-2'
			);
		});
	});

	describe('WithdrawRevolution button', () => {
		test('replies with no revolution ongoing when revolution is not active', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('WithdrawRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('No revolution ongoing')
			);
		});

		test('replies with not joined message when not a participant', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);
			const interaction = makeInteraction('WithdrawRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				"You've not joined revolution."
			);
		});

		test('emits RemoveRevolutionParticipant and sends confirmation on success', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);
			const interaction = makeInteraction('WithdrawRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(eventEmitter.emit).toHaveBeenCalledWith('RemoveRevolutionParticipant', 'user-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You have withdrawn the revolution'
			);
		});
	});

	describe('VoteEmperor button', () => {
		test('replies with no active election message when election is not active', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(false);
			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'There is no active election to vote.'
			);
		});

		test('replies with no member selected when no candidate chosen', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			const interaction = makeInteraction('VoteEmperor', { userId: 'new-user' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'No member selected'
			);
		});

		test('replies with already joined message when already a participant', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);
			const sel = makeInteraction('SelectEmperorCandidate', {
				isSelect: true,
				userId: 'user-1',
				values: ['candidate-1'],
				fetchedMember: {
					id: 'candidate-1',
					user: { id: 'candidate-1', username: 'Candidate' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				"You've already joined the election."
			);
		});

		test('emits AddRevolutionParticipant and sends confirmation on success', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);
			const sel = makeInteraction('SelectEmperorCandidate', {
				isSelect: true,
				userId: 'user-1',
				values: ['candidate-1'],
				fetchedMember: {
					id: 'candidate-1',
					user: { id: 'candidate-1', username: 'Candidate' },
					roles: { cache: { has: jest.fn().mockReturnValue(false) } },
				},
			});
			await handlers.interactionCreate(sel);
			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				'AddRevolutionParticipant',
				'Merchant',
				'user-1',
				'candidate-1'
			);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You have joined the election.'
			);
		});
	});

	describe('xpModal submission', () => {
		async function selectBribeTarget(userId = 'user-1', targetId = 'target-2') {
			CacheGetCooldown.mockResolvedValue(null);
			const targetMember = {
				id: targetId,
				user: { id: targetId, username: 'BribeTarget' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			const sel = makeInteraction('BribeSelectMenu', {
				isSelect: true,
				userId,
				values: [targetId],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(sel);
		}

		test('replies with not enough drops when merchant XP is insufficient', async () => {
			CacheGetUserXP.mockResolvedValue(50);
			await selectBribeTarget();
			const interaction = makeInteraction('xpModal', {
				isModal: true,
				userId: 'user-1',
				fields: { xpAmount: '200', optionalMessage: '' },
			});
			await handlers.interactionCreate(interaction);
			expect(interaction.reply).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.stringContaining("don't have enough drops"),
				})
			);
		});

		test('deducts XP from merchant and grants to target on success', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			await selectBribeTarget('user-1', 'target-2');
			const interaction = makeInteraction('xpModal', {
				isModal: true,
				userId: 'user-1',
				fields: { xpAmount: '100', optionalMessage: '' },
			});
			await handlers.interactionCreate(interaction);
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -100, client);
			expect(DBUpdateXP).toHaveBeenCalledWith('target-2', 100, client);
		});

		test('sets bribe cooldown after successful bribe', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			await selectBribeTarget();
			const interaction = makeInteraction('xpModal', {
				isModal: true,
				userId: 'user-1',
				fields: { xpAmount: '100', optionalMessage: '' },
			});
			await handlers.interactionCreate(interaction);
			expect(CacheSetCooldown).toHaveBeenCalledWith('Bribe', 'user-1', 120000);
		});

		test('replies with success message containing granted amount', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			await selectBribeTarget();
			const interaction = makeInteraction('xpModal', {
				isModal: true,
				userId: 'user-1',
				fields: { xpAmount: '100', optionalMessage: '' },
			});
			await handlers.interactionCreate(interaction);
			expect(interaction.reply).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.stringContaining('Successfully granted 100 drops'),
				})
			);
		});
	});

	describe('guildMemberRemove handler', () => {
		test('is registered on the client', () => {
			expect(client.on).toHaveBeenCalledWith('guildMemberRemove', expect.any(Function));
		});
	});

	describe('guildMemberUpdate handler', () => {
		test('is registered on the client', () => {
			expect(client.on).toHaveBeenCalledWith('guildMemberUpdate', expect.any(Function));
		});
	});

	describe('interaction filter', () => {
		test('returns early when interaction is neither button, select menu, nor modal', async () => {
			const interaction = {
				customId: 'Bribe',
				user: { id: 'user-1' },
				isStringSelectMenu: () => false,
				isButton: () => false,
				isModalSubmit: () => false,
				reply: jest.fn(),
			};
			await handlers.interactionCreate(interaction);
			expect(interaction.reply).not.toHaveBeenCalled();
		});
	});
});
