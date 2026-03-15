jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetCooldown: jest.fn().mockResolvedValue(null),
	CacheSetCooldown: jest.fn().mockResolvedValue(),
	CacheGetUserXP: jest.fn().mockResolvedValue(1000),
	CacheGetWriterWrits: jest.fn().mockResolvedValue([]),
	CacheSetWrit: jest.fn().mockResolvedValue(),
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../apis/firebase/querys', () => ({
	DBUpdateXP: jest.fn().mockResolvedValue(),
	isThresholdOpen: jest.fn().mockResolvedValue(true),
	changeRole: jest.fn().mockResolvedValue(),
	openThreshold: jest.fn().mockResolvedValue(),
	closeThreshold: jest.fn().mockResolvedValue(),
}));

jest.mock('../../game_config.json', () => ({
	NobleLordElectionTime: 30000,
	LordKingElectionTime: 30000,
	NobleLordElectionSuccessThreshold: 0.5,
	LordKingElectionSuccessThreshold: 0.5,
	LordElectionCooldown: 1200000,
	EminentWritCooldown: 1200000,
	ExileCooldown: 1200000,
	ExileCost: 100,
	RoleChangeMessageDisplayTime: 5000,
	TextLordMessageContent: 'lord content',
	TextEminentWritKnightSelectMenu: 'Select Knight',
	TextEminentWritTargetSelectMenu: 'Select Target',
	TextElectionSelectMenu: 'Select Election Candidate',
	TextExileSelectMenu: 'Select Exile Target',
	ButtonLabelExile: 'Exile',
	ButtonLabelEminentWrit: 'Eminent Writ',
	ButtonLabelElection: 'Election',
	ButtonLabelElectionVote: 'Vote',
	ButtonLabelShowWrits: 'Show Writs',
	MinimumLordSize: 2,
	MinimumLordSizeForElection: 2,
}));

jest.mock('../../functions/botActions.js', () => ({
	buildSelectMenu: jest.fn().mockResolvedValue({
		setCustomId: jest.fn().mockReturnThis(),
		setPlaceholder: jest.fn().mockReturnThis(),
		setDisabled: jest.fn().mockReturnThis(),
		addOptions: jest.fn().mockReturnThis(),
	}),
	sendInteractionReply: jest.fn().mockResolvedValue(),
	messageAllHumanChannels: jest.fn().mockResolvedValue(),
	messageChannel: jest.fn().mockResolvedValue(),
}));

jest.mock('../../functions/eventEmitter.js', () => ({
	eventEmitter: { emit: jest.fn(), on: jest.fn() },
}));

jest.mock('../../game_state.js', () => ({
	isServerDown: jest.fn().mockReturnValue(false),
	getRoleSize: jest.fn().mockReturnValue(5),
	getDisableElection: jest.fn().mockReturnValue(false),
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
			components: [mockMenu(), mockMenu(), mockMenu(), mockMenu()],
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
	function mockModal() {
		return {
			setCustomId: jest.fn().mockReturnThis(),
			setTitle: jest.fn().mockReturnThis(),
			addComponents: jest.fn().mockReturnThis(),
		};
	}
	function mockTextInput() {
		return {
			setCustomId: jest.fn().mockReturnThis(),
			setLabel: jest.fn().mockReturnThis(),
			setStyle: jest.fn().mockReturnThis(),
			setRequired: jest.fn().mockReturnThis(),
			setMaxLength: jest.fn().mockReturnThis(),
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
		ModalBuilder: jest.fn().mockImplementation(() => mockModal()),
		TextInputBuilder: jest.fn().mockImplementation(() => mockTextInput()),
		TextInputStyle: { Paragraph: 1, Short: 2 },
	};
});

function makeMockClient() {
	const mockMsg = {
		edit: jest.fn().mockResolvedValue({}),
		components: Array(5).fill(null).map(() => ({
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
		user: { id: opts.targetId || 'target-1', username: 'TargetUser' },
		roles: { cache: { has: jest.fn().mockReturnValue(opts.isNoble === true) } },
	};
	return {
		customId,
		user: { id: opts.userId || 'user-1', username: opts.username || 'TestUser' },
		client: { users: { fetch: jest.fn().mockResolvedValue({ id: 'u', username: 'Unknown' }) } },
		replied: false,
		deferred: false,
		reply: jest.fn().mockResolvedValue({}),
		deferUpdate: jest.fn().mockResolvedValue({}),
		deferReply: jest.fn().mockResolvedValue({}),
		showModal: jest.fn().mockResolvedValue({}),
		values: opts.values || ['target-1'],
		guild: { members: { fetch: jest.fn().mockResolvedValue(fetchedMember) } },
		fields: opts.fields || null,
		isStringSelectMenu: () => opts.isSelect === true,
		isButton: () => opts.isSelect !== true && opts.isModal !== true,
		isModalSubmit: () => opts.isModal === true,
	};
}

describe('lord_commands interactions', () => {
	let setupLordBotEvents;
	let CacheGetCooldown;
	let CacheSetCooldown;
	let CacheGetUserXP;
	let CacheGetWriterWrits;
	let CacheSetWrit;
	let DBUpdateXP;
	let changeRole;
	let eventEmitter;
	let sendInteractionReply;
	let gameState;
	let handlers;
	let client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupLordBotEvents } = require('../../role_commands/lord_commands'));
		({ CacheGetCooldown, CacheSetCooldown, CacheGetUserXP, CacheGetWriterWrits, CacheSetWrit } = require('../../apis/redis/redisCache'));
		({ DBUpdateXP, changeRole } = require('../../apis/firebase/querys'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));
		({ sendInteractionReply } = require('../../functions/botActions.js'));
		gameState = require('../../game_state.js');

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;
		setupLordBotEvents(client, 'msg-id');
	});

	describe('SelectExile', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectExile', { isSelect: true, values: ['peas-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('peas-1');
		});
	});

	describe('SelectHuman', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectHuman', { isSelect: true, values: ['human-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('human-1');
		});
	});

	describe('SelectKnight', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectKnight', { isSelect: true, values: ['knight-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('knight-1');
		});
	});

	describe('ElectionSelectMenu', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('ElectionSelectMenu', { isSelect: true, values: ['noble-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('noble-1');
		});
	});

	describe('Exile', () => {
		test('replies with no target selected when none picked', async () => {
			const interaction = makeInteraction('Exile', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No peasant, scholar or merchant selected')
			);
		});

		test('replies with not enough drops when XP is below cost', async () => {
			CacheGetUserXP.mockResolvedValue(50); // below ExileCost of 100
			const target = { id: 'peas-1', user: { id: 'peas-1', username: 'Peasant' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectExile', {
				isSelect: true, userId: 'user-1', values: ['peas-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Exile', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when exile is on cooldown', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(1200000);

			const target = { id: 'peas-1', user: { id: 'peas-1', username: 'Peasant' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectExile', {
				isSelect: true, userId: 'user-1', values: ['peas-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Exile', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Exile is on cooldown and cannot be used'
			);
		});

		test('executes exile: changes role, deducts XP, sets cooldown, emits ExileComplete', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(null);

			const target = { id: 'peas-1', user: { id: 'peas-1', username: 'Peasant' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectExile', {
				isSelect: true, userId: 'user-1', values: ['peas-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Exile', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(changeRole).toHaveBeenCalledWith(target, 'Sub-human', false);
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -100, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('exile', 'user-1', 1200000);
			expect(eventEmitter.emit).toHaveBeenCalledWith('ExileComplete', 'peas-1', 'user-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('exiled')
			);
		});
	});

	describe('EminentWrit', () => {
		test('replies with no knight or target selected when neither picked', async () => {
			const interaction = makeInteraction('EminentWrit', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No knight or target selected.'
			);
		});

		test('replies with cooldown message when on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(1200000);

			const knight = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const human = { id: 'human-1', user: { id: 'human-1', username: 'Human' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			await handlers.interactionCreate(makeInteraction('SelectKnight', { isSelect: true, userId: 'user-1', values: ['knight-1'], fetchedMember: knight }));
			await handlers.interactionCreate(makeInteraction('SelectHuman', { isSelect: true, userId: 'user-1', values: ['human-1'], fetchedMember: human }));

			const interaction = makeInteraction('EminentWrit', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Eminent Writ is on cooldown and cannot be used.'
			);
		});

		test('shows modal when knight and human selected with no cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(null);

			const knight = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const human = { id: 'human-1', user: { id: 'human-1', username: 'Human' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			await handlers.interactionCreate(makeInteraction('SelectKnight', { isSelect: true, userId: 'user-1', values: ['knight-1'], fetchedMember: knight }));
			await handlers.interactionCreate(makeInteraction('SelectHuman', { isSelect: true, userId: 'user-1', values: ['human-1'], fetchedMember: human }));

			const interaction = makeInteraction('EminentWrit', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(interaction.showModal).toHaveBeenCalled();
		});
	});

	describe('EminentWritModal', () => {
		function makeModalInteraction(opts = {}) {
			return {
				customId: 'EminentWritModal',
				user: { id: opts.userId || 'user-1', username: 'TestUser' },
				client: { users: { fetch: jest.fn().mockResolvedValue({ id: 'u', username: 'Unknown' }) } },
				reply: jest.fn().mockResolvedValue({}),
				deferUpdate: jest.fn().mockResolvedValue({}),
				deferReply: jest.fn().mockResolvedValue({}),
				showModal: jest.fn().mockResolvedValue({}),
				values: [],
				guild: { members: { fetch: jest.fn() } },
				fields: {
					getTextInputValue: jest.fn((id) => {
						if (id === 'messageToKnight') return opts.message || 'Execute them';
						if (id === 'amountInput') return String(opts.amount !== undefined ? opts.amount : 50);
						return '';
					}),
				},
				isStringSelectMenu: () => false,
				isButton: () => false,
				isModalSubmit: () => true,
			};
		}

		test('replies with invalid amount for non-numeric input', async () => {
			// First set up selected knight and human
			const knight = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const human = { id: 'human-1', user: { id: 'human-1', username: 'Human' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			await handlers.interactionCreate(makeInteraction('SelectKnight', { isSelect: true, userId: 'user-1', values: ['knight-1'], fetchedMember: knight }));
			await handlers.interactionCreate(makeInteraction('SelectHuman', { isSelect: true, userId: 'user-1', values: ['human-1'], fetchedMember: human }));

			const interaction = makeModalInteraction({ userId: 'user-1', amount: 'not-a-number' });
			interaction.fields.getTextInputValue = jest.fn((id) => {
				if (id === 'amountInput') return 'not-a-number';
				return 'message';
			});
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Invalid amount')
			);
		});

		test('replies with not enough drops when XP is below writ amount', async () => {
			CacheGetUserXP.mockResolvedValue(30); // below amount of 50

			const knight = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const human = { id: 'human-1', user: { id: 'human-1', username: 'Human' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			await handlers.interactionCreate(makeInteraction('SelectKnight', { isSelect: true, userId: 'user-1', values: ['knight-1'], fetchedMember: knight }));
			await handlers.interactionCreate(makeInteraction('SelectHuman', { isSelect: true, userId: 'user-1', values: ['human-1'], fetchedMember: human }));

			const interaction = makeModalInteraction({ userId: 'user-1', amount: 50 });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining("don't have enough drops")
			);
		});

		test('creates writ, deducts XP, sets cooldown on success', async () => {
			CacheGetUserXP.mockResolvedValue(500);

			const knight = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const human = { id: 'human-1', user: { id: 'human-1', username: 'Human' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			await handlers.interactionCreate(makeInteraction('SelectKnight', { isSelect: true, userId: 'user-1', values: ['knight-1'], fetchedMember: knight }));
			await handlers.interactionCreate(makeInteraction('SelectHuman', { isSelect: true, userId: 'user-1', values: ['human-1'], fetchedMember: human }));

			const interaction = makeModalInteraction({ userId: 'user-1', amount: 50, message: 'Execute them' });
			await handlers.interactionCreate(interaction);

			expect(CacheSetWrit).toHaveBeenCalledWith(2, 'user-1', 'knight-1', 'human-1', 0, 'Execute them', 50);
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -50, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('eminentWrit', 'user-1', 1200000);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Eminent Writ')
			);
		});
	});

	describe('ShowWrits', () => {
		test('replies with no writs message when user has no writs', async () => {
			CacheGetWriterWrits.mockResolvedValue([]);
			const interaction = makeInteraction('ShowWrits', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'You have not issued any writs.'
			);
		});

		test('replies with writ details when user has writs', async () => {
			CacheGetWriterWrits.mockResolvedValue([
				{ knightId: 'knight-1', targetId: 'target-1', writStatus: 0, writMessage: 'Execute', writAmount: 50 },
			]);
			const interaction = makeInteraction('ShowWrits', { userId: 'user-1' });
			interaction.client.users.fetch = jest.fn().mockResolvedValue({ id: 'knight-1', username: 'KnightUser' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Your issued writs')
			);
		});
	});

	describe('Election', () => {
		test('replies with no member selected when no candidate picked', async () => {
			const interaction = makeInteraction('Election', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No member selected'
			);
		});

		test('replies with cooldown message when election is on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(1200000);

			const candidate = { id: 'noble-1', user: { id: 'noble-1', username: 'Noble' }, roles: { cache: { has: jest.fn().mockReturnValue(true) } } };
			await handlers.interactionCreate(makeInteraction('ElectionSelectMenu', { isSelect: true, userId: 'user-1', values: ['noble-1'], fetchedMember: candidate }));

			const interaction = makeInteraction('Election', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Election is on cooldown'
			);
		});

		test('replies with cannot elect yourself for self-election', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			gameState.getRoleSize.mockReturnValue(5);

			const selfCandidate = { id: 'user-1', user: { id: 'user-1', username: 'Self' }, roles: { cache: { has: jest.fn().mockReturnValue(true) } } };
			await handlers.interactionCreate(makeInteraction('ElectionSelectMenu', { isSelect: true, userId: 'user-1', values: ['user-1'], fetchedMember: selfCandidate }));

			const interaction = makeInteraction('Election', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You cannot elect yourself.'
			);
		});

		test('replies with minimum lord size message when not enough lords', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			gameState.getRoleSize.mockReturnValue(1); // below MinimumLordSizeForElection of 2

			const candidate = { id: 'noble-1', user: { id: 'noble-1', username: 'Noble' }, roles: { cache: { has: jest.fn().mockReturnValue(true) } } };
			await handlers.interactionCreate(makeInteraction('ElectionSelectMenu', { isSelect: true, userId: 'user-1', values: ['noble-1'], fetchedMember: candidate }));

			const interaction = makeInteraction('Election', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('must be at least')
			);
		});

		test('starts election successfully when conditions are met', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			gameState.getRoleSize.mockReturnValue(5);

			const candidate = { id: 'noble-1', user: { id: 'noble-1', username: 'Noble' }, roles: { cache: { has: jest.fn().mockReturnValue(true) } } };
			await handlers.interactionCreate(makeInteraction('ElectionSelectMenu', { isSelect: true, userId: 'user-1', values: ['noble-1'], fetchedMember: candidate }));

			const interaction = makeInteraction('Election', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Election started')
			);
		});
	});

	describe('Vote', () => {
		async function startElection(initiatorId = 'lord-1') {
			CacheGetCooldown.mockResolvedValue(null);
			gameState.getRoleSize.mockReturnValue(5);
			const candidate = { id: 'noble-1', user: { id: 'noble-1', username: 'Noble' }, roles: { cache: { has: jest.fn().mockReturnValue(true) } } };
			await handlers.interactionCreate(makeInteraction('ElectionSelectMenu', { isSelect: true, userId: initiatorId, values: ['noble-1'], fetchedMember: candidate }));
			await handlers.interactionCreate(makeInteraction('Election', { userId: initiatorId }));
		}

		test('replies with no active election when none ongoing', async () => {
			const interaction = makeInteraction('Vote', { userId: 'lord-2' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'There is no active election to join.'
			);
		});

		test('blocks initiator from voting in their own election', async () => {
			await startElection('lord-1');
			const interaction = makeInteraction('Vote', { userId: 'lord-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining("don't need to vote")
			);
		});

		test('blocks the candidate from voting for themselves', async () => {
			await startElection('lord-1');
			const interaction = makeInteraction('Vote', { userId: 'noble-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'You cannot vote yourself.'
			);
		});

		test('blocks user from voting twice', async () => {
			await startElection('lord-1');
			await handlers.interactionCreate(makeInteraction('Vote', { userId: 'lord-2' }));
			const revote = makeInteraction('Vote', { userId: 'lord-2' });
			await handlers.interactionCreate(revote);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				revote,
				"You've already voted."
			);
		});

		test('adds vote successfully and replies', async () => {
			await startElection('lord-1');
			const interaction = makeInteraction('Vote', { userId: 'lord-2' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('joind the poll')
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
		test('returns early when interaction is not button, select, or modal', async () => {
			const interaction = {
				customId: 'Election',
				user: { id: 'user-1' },
				isStringSelectMenu: () => false,
				isButton: () => false,
				isModalSubmit: () => false,
				reply: jest.fn(),
			};
			await handlers.interactionCreate(interaction);
			expect(interaction.reply).not.toHaveBeenCalled();
			expect(sendInteractionReply).not.toHaveBeenCalled();
		});
	});

	describe('eventEmitter listeners', () => {
		test('registers UpdateLordMessageIfNoElectionOngoing listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('UpdateLordMessageIfNoElectionOngoing', expect.any(Function));
		});

		test('registers NotifyLordChannel listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('NotifyLordChannel', expect.any(Function));
		});

		test('registers ServerStatusChange listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('ServerStatusChange', expect.any(Function));
		});

		test('registers ExileComplete listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('ExileComplete', expect.any(Function));
		});
	});
});
