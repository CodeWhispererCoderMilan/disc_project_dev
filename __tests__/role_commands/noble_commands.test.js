jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetCooldown: jest.fn().mockResolvedValue(null),
	CacheSetCooldown: jest.fn().mockResolvedValue(),
	CacheGetUserXP: jest.fn().mockResolvedValue(1000),
	CacheGetWriterWrits: jest.fn().mockResolvedValue([]),
	CacheSetWrit: jest.fn().mockResolvedValue(),
}));

jest.mock('../../apis/firebase/querys', () => ({
	DBUpdateXP: jest.fn().mockResolvedValue(),
	changeRole: jest.fn().mockResolvedValue(),
}));

jest.mock('../../game_config.json', () => ({
	AssassinationTime: 40000,
	AssassinationThreshold: 3,
	GlobalCooldown: 20000,
	RoleChangeMessageDisplayTime: 60000,
	HighWritCooldown: 120000,
	TextNobleMessageContent: 'noble content',
	ButtonLabelShowWrits: 'Show Writs',
	ButtonLabelHighWrit: 'Writ',
	ButtonLabelAssassination: 'Assassinate',
	ButtonLabelJoinAssassination: 'Join',
	TextAssassinationSelectMenu: 'Select target',
	TextHighWritKnightSelectMenu: 'Select knight',
	TextHighWritTargetSelectMenu: 'Select target',
}));

jest.mock('../../functions/botActions', () => ({
	buildSelectMenu: jest.fn().mockResolvedValue({
		setCustomId: jest.fn().mockReturnThis(),
		setPlaceholder: jest.fn().mockReturnThis(),
		setDisabled: jest.fn().mockReturnThis(),
		addOptions: jest.fn().mockReturnThis(),
		toJSON: jest.fn().mockReturnValue({}),
	}),
	sendInteractionReply: jest.fn().mockResolvedValue(),
	messageChannel: jest.fn().mockResolvedValue(),
}));

jest.mock('../../functions/eventEmitter.js', () => ({
	eventEmitter: { emit: jest.fn(), on: jest.fn() },
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
	const MockActionRowBuilder = jest.fn().mockImplementation(() => mockRow());
	MockActionRowBuilder.from = jest.fn().mockImplementation(() => mockRow());
	const MockStringSelectMenuBuilder = jest.fn().mockImplementation(() => mockMenu());
	MockStringSelectMenuBuilder.from = jest.fn().mockImplementation(() => mockMenu());
	return {
		ActionRowBuilder: MockActionRowBuilder,
		StringSelectMenuBuilder: MockStringSelectMenuBuilder,
		ButtonBuilder: jest.fn().mockImplementation(() => ({
			setCustomId: jest.fn().mockReturnThis(),
			setLabel: jest.fn().mockReturnThis(),
			setStyle: jest.fn().mockReturnThis(),
			setDisabled: jest.fn().mockReturnThis(),
		})),
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
			setRequired: jest.fn().mockReturnThis(),
			setMaxLength: jest.fn().mockReturnThis(),
		})),
		TextInputStyle: { Paragraph: 0, Short: 1 },
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
		emit: jest.fn(),
		channels: { fetch: jest.fn().mockResolvedValue(mockChannel) },
		guilds: { fetch: jest.fn().mockResolvedValue({}) },
	};
	return { client, handlers, mockChannel };
}

function makeInteraction(customId, opts = {}) {
	const fetchedMember = opts.fetchedMember || {
		id: opts.targetId || 'target-1',
		user: { id: opts.targetId || 'target-1', username: 'TargetUser' },
	};
	return {
		customId,
		user: { id: opts.userId || 'user-1', username: opts.username || 'Noble1' },
		replied: false,
		deferred: false,
		reply: jest.fn().mockResolvedValue({}),
		deferUpdate: jest.fn().mockResolvedValue({}),
		showModal: jest.fn().mockResolvedValue({}),
		values: opts.values || ['target-1'],
		guild: { members: { fetch: jest.fn().mockResolvedValue(fetchedMember) } },
		isStringSelectMenu: () => opts.isSelect === true,
		isButton: () => opts.isButton !== false && opts.isSelect !== true,
		isModalSubmit: () => opts.isModal === true,
		fields: {
			getTextInputValue: opts.getTextInputValue || jest.fn()
				.mockReturnValueOnce('Kill the target')
				.mockReturnValueOnce('200'),
		},
		client: {
			users: {
				fetch: jest.fn().mockResolvedValue({ id: 'fetched-id', username: 'FetchedUser' }),
			},
		},
		member: opts.member || { id: opts.userId || 'user-1' },
	};
}

describe('noble_commands interactions', () => {
	let setupNobleBotEvents;
	let CacheGetCooldown;
	let CacheGetUserXP;
	let CacheSetCooldown;
	let CacheSetWrit;
	let CacheGetWriterWrits;
	let DBUpdateXP;
	let changeRole;
	let sendInteractionReply;
	let messageChannel;
	let eventEmitter;
	let handlers;
	let client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupNobleBotEvents } = require('../../role_commands/noble_commands'));
		({ CacheGetCooldown, CacheGetUserXP, CacheSetCooldown, CacheSetWrit, CacheGetWriterWrits } = require('../../apis/redis/redisCache'));
		({ DBUpdateXP, changeRole } = require('../../apis/firebase/querys'));
		({ sendInteractionReply, messageChannel } = require('../../functions/botActions'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;

		process.env.CHANNELIDNOBLE = 'ch-noble';
		process.env.CHANNELID_GREAT_COUNCIL = 'ch-council';
		process.env.CHANNELID_BOGLAND_ESTATES = 'ch-bog';

		setupNobleBotEvents(client, 'msg-id');
	});

	describe('SelectHuman', () => {
		test('defers update and fetches selected member', async () => {
			const interaction = makeInteraction('SelectHuman', { isSelect: true, values: ['human-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('human-1');
		});
	});

	describe('SelectKnight', () => {
		test('defers update and fetches selected knight', async () => {
			const interaction = makeInteraction('SelectKnight', { isSelect: true, values: ['knight-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('knight-1');
		});
	});

	describe('HighWrit button', () => {
		test('replies with error when no knight or target selected', async () => {
			await handlers.interactionCreate(makeInteraction('HighWrit', { userId: 'user-new' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'No knight or target selected.'
			);
		});

		test('replies with cooldown message when on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(120000);
			// Set up both a human and knight selection for user-1
			const selHuman = makeInteraction('SelectHuman', { isSelect: true, userId: 'user-1', values: ['h1'] });
			const selKnight = makeInteraction('SelectKnight', { isSelect: true, userId: 'user-1', values: ['k1'] });
			await handlers.interactionCreate(selHuman);
			await handlers.interactionCreate(selKnight);

			await handlers.interactionCreate(makeInteraction('HighWrit', { userId: 'user-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'High Writ is on cooldown and cannot be used.'
			);
		});

		test('shows modal when no cooldown and selections made', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			const selHuman = makeInteraction('SelectHuman', { isSelect: true, userId: 'user-1', values: ['h1'] });
			const selKnight = makeInteraction('SelectKnight', { isSelect: true, userId: 'user-1', values: ['k1'] });
			await handlers.interactionCreate(selHuman);
			await handlers.interactionCreate(selKnight);

			const interaction = makeInteraction('HighWrit', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(interaction.showModal).toHaveBeenCalled();
		});
	});

	describe('HighWritModal submission', () => {
		async function setupSelectionsForUser(userId = 'user-1') {
			const selH = makeInteraction('SelectHuman', {
				isSelect: true, userId,
				values: ['h1'],
				fetchedMember: { id: 'h1', user: { id: 'h1', username: 'Human1' } },
			});
			const selK = makeInteraction('SelectKnight', {
				isSelect: true, userId,
				values: ['k1'],
				fetchedMember: { id: 'k1', user: { id: 'k1', username: 'Knight1' } },
			});
			await handlers.interactionCreate(selH);
			await handlers.interactionCreate(selK);
		}

		test('replies with error for non-numeric amount', async () => {
			await setupSelectionsForUser('user-1');
			const interaction = makeInteraction('HighWritModal', {
				isModal: true, userId: 'user-1',
				getTextInputValue: jest.fn()
					.mockReturnValueOnce('message text')
					.mockReturnValueOnce('not-a-number'),
			});
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Invalid amount of drops. Please enter a positive number.'
			);
		});

		test('replies with error for zero or negative amount', async () => {
			await setupSelectionsForUser('user-1');
			const interaction = makeInteraction('HighWritModal', {
				isModal: true, userId: 'user-1',
				getTextInputValue: jest.fn()
					.mockReturnValueOnce('message text')
					.mockReturnValueOnce('0'),
			});
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Invalid amount of drops. Please enter a positive number.'
			);
		});

		test('replies with error when not enough XP', async () => {
			CacheGetUserXP.mockResolvedValue(100);
			await setupSelectionsForUser('user-1');
			const interaction = makeInteraction('HighWritModal', {
				isModal: true, userId: 'user-1',
				getTextInputValue: jest.fn()
					.mockReturnValueOnce('message')
					.mockReturnValueOnce('500'), // 500 > 100 XP
			});
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining("don't have enough drops")
			);
		});

		test('creates writ, deducts XP, sets cooldown on success', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			await setupSelectionsForUser('user-1');
			const interaction = makeInteraction('HighWritModal', {
				isModal: true, userId: 'user-1',
				getTextInputValue: jest.fn()
					.mockReturnValueOnce('Execute them')
					.mockReturnValueOnce('200'),
			});
			await handlers.interactionCreate(interaction);
			expect(CacheSetWrit).toHaveBeenCalledWith(1, 'user-1', 'k1', 'h1', 0, 'Execute them', 200);
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -200, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('highWrit', 'user-1', 120000);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('High Writ of execution succesfully emitted')
			);
		});
	});

	describe('ShowWrits', () => {
		test('replies with no writs message when user has none', async () => {
			CacheGetWriterWrits.mockResolvedValue([]);
			await handlers.interactionCreate(makeInteraction('ShowWrits', { userId: 'user-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You have not issued any writs.'
			);
		});

		test('replies with writ list when user has writs', async () => {
			CacheGetWriterWrits.mockResolvedValue([
				{ knightId: 'k1', targetId: 't1', writStatus: 0, writMessage: 'kill him', writAmount: 100 },
			]);
			const interaction = makeInteraction('ShowWrits', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('Your issued writs')
			);
		});
	});

	describe('AssassinationTargetSelectMenu', () => {
		test('defers update and fetches target member', async () => {
			const interaction = makeInteraction('AssassinationTargetSelectMenu', {
				isSelect: true, userId: 'user-1', values: ['target-1'],
			});
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('target-1');
		});
	});

	describe('Assassination button', () => {
		test('replies with error when no target selected', async () => {
			await handlers.interactionCreate(makeInteraction('Assassination', { userId: 'brand-new-user' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'No member selected'
			);
		});

		test('blocks self-targeting', async () => {
			// Select self as target
			const sel = makeInteraction('AssassinationTargetSelectMenu', {
				isSelect: true, userId: 'user-1', values: ['user-1'],
				fetchedMember: { id: 'user-1', user: { id: 'user-1', username: 'Noble1' } },
			});
			await handlers.interactionCreate(sel);
			await handlers.interactionCreate(makeInteraction('Assassination', { userId: 'user-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You cannot target yourself.'
			);
		});

		test('replies with cooldown message when on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(20000);
			const sel = makeInteraction('AssassinationTargetSelectMenu', {
				isSelect: true, userId: 'user-1', values: ['target-99'],
				fetchedMember: { id: 'target-99', user: { id: 'target-99', username: 'Target99' } },
			});
			await handlers.interactionCreate(sel);
			await handlers.interactionCreate(makeInteraction('Assassination', { userId: 'user-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Assassination is on cooldown'
			);
		});

		test('initiates assassination and replies with confirmation', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			const targetMember = { id: 'target-2', user: { id: 'target-2', username: 'Target2' } };
			const sel = makeInteraction('AssassinationTargetSelectMenu', {
				isSelect: true, userId: 'user-1', values: ['target-2'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(sel);
			await handlers.interactionCreate(makeInteraction('Assassination', { userId: 'user-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Assassination initiated, waiting for other nobles to join.'
			);
			expect(messageChannel).toHaveBeenCalled();
		});
	});

	describe('JoinAssassination button', () => {
		async function startAssassination(initiatorId = 'initiator-1', targetId = 'target-99') {
			CacheGetCooldown.mockResolvedValue(null);
			const targetMember = { id: targetId, user: { id: targetId, username: 'TargetUser' } };
			const sel = makeInteraction('AssassinationTargetSelectMenu', {
				isSelect: true, userId: initiatorId, values: [targetId],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(sel);
			await handlers.interactionCreate(makeInteraction('Assassination', { userId: initiatorId }));
		}

		test('replies with no active assassination message', async () => {
			await handlers.interactionCreate(makeInteraction('JoinAssassination', { userId: 'outsider' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'There is no active assassination to join.'
			);
		});

		test('blocks initiator from joining their own plot', async () => {
			await startAssassination('initiator-1', 'target-99');
			await handlers.interactionCreate(makeInteraction('JoinAssassination', { userId: 'initiator-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You cannot join your own plot'
			);
		});

		test('blocks the target from joining', async () => {
			await startAssassination('initiator-1', 'target-99');
			await handlers.interactionCreate(makeInteraction('JoinAssassination', { userId: 'target-99' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You cannot join an assassination targeted you.'
			);
		});

		test('allows a new noble to join and replies with confirmation', async () => {
			await startAssassination('initiator-1', 'target-99');
			await handlers.interactionCreate(makeInteraction('JoinAssassination', { userId: 'joiner-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				"You've joiend the assassination."
			);
		});

		test('blocks duplicate join', async () => {
			await startAssassination('initiator-1', 'target-99');
			// First join
			await handlers.interactionCreate(makeInteraction('JoinAssassination', { userId: 'joiner-1' }));
			jest.clearAllMocks();
			// Second join attempt
			await handlers.interactionCreate(makeInteraction('JoinAssassination', { userId: 'joiner-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				"You've already the plot."
			);
		});

		test('ceases assassination immediately when threshold is reached', async () => {
			// AssassinationThreshold = 3, initiator = 1, so need 2 joiners
			await startAssassination('initiator-1', 'target-99');
			jest.clearAllMocks();
			await handlers.interactionCreate(makeInteraction('JoinAssassination', { userId: 'joiner-1' }));
			await handlers.interactionCreate(makeInteraction('JoinAssassination', { userId: 'joiner-2' }));
			// At threshold, ceaseAssassination is called → handleAssassinationEnd → changeRole
			expect(changeRole).toHaveBeenCalled();
		});
	});

	describe('interaction filter', () => {
		test('returns early for non-button, non-select, non-modal interactions', async () => {
			const interaction = {
				customId: 'Assassination',
				user: { id: 'u1' },
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
