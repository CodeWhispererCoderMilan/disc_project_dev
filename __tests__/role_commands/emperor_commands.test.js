jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetUserXP: jest.fn().mockResolvedValue(1000),
	CacheGetCooldown: jest.fn().mockResolvedValue(null),
	CacheSetCooldown: jest.fn().mockResolvedValue(),
	CacheGetWriterWrits: jest.fn().mockResolvedValue([]),
	CacheSetWrit: jest.fn().mockResolvedValue(),
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../apis/firebase/querys', () => ({
	DBUpdateXP: jest.fn().mockResolvedValue(),
	changeRole: jest.fn().mockResolvedValue(),
	isThresholdOpen: jest.fn().mockReturnValue(false),
	openThreshold: jest.fn().mockResolvedValue(),
	closeThreshold: jest.fn(),
}));

jest.mock('../../game_config.json', () => ({
	CoronationCost: 400,
	CoronationCooldown: 120000,
	DethroneCost: 400,
	DethroneCooldown: 120000,
	HeirCost: 400,
	HeirCooldown: 120000,
	ImperialWritCooldown: 120000,
	TextEmperorMessageContent: 'emperor content',
	TextCoronationSelectMenu: 'Name a king',
	TextHeirDethroneSelectMenu: 'Pick a king',
	TextImperialWritTargetSelectMenu: 'Pick a target',
	TextImperialWritKnightSelectMenu: 'Pick a knight',
	ButtonLabelCoronation: 'Coronation',
	ButtonLabelHeir: 'Choose Heir',
	ButtonLabelDethrone: 'Dethrone',
	ButtonLabelImperialWrit: 'Writ',
	ButtonLabelShowWrits: 'Read Writs',
}));

jest.mock('../../functions/botActions', () => ({
	sendInteractionReply: jest.fn().mockResolvedValue(),
	buildSelectMenu: jest.fn().mockResolvedValue({
		setCustomId: jest.fn().mockReturnThis(),
		setPlaceholder: jest.fn().mockReturnThis(),
		setDisabled: jest.fn().mockReturnThis(),
		addOptions: jest.fn().mockReturnThis(),
		toJSON: jest.fn().mockReturnValue({}),
	}),
	messageChannel: jest.fn().mockResolvedValue(),
	messageAllHumanChannels: jest.fn().mockResolvedValue(),
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
	return { client, handlers };
}

function makeInteraction(customId, opts = {}) {
	const fetchedMember = opts.fetchedMember || {
		id: opts.targetId || 'target-1',
		user: { id: opts.targetId || 'target-1', username: 'TargetUser' },
	};
	return {
		customId,
		user: { id: opts.userId || 'emperor-1', username: opts.username || 'Emperor' },
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
				.mockReturnValueOnce('Execute message')
				.mockReturnValueOnce('200'),
		},
		client: {
			users: {
				fetch: jest.fn().mockResolvedValue({ id: 'fetched-id', username: 'FetchedUser' }),
			},
		},
		member: opts.member || { id: opts.userId || 'emperor-1' },
	};
}

describe('emperor_commands interactions', () => {
	let setupEmperorBotEvents;
	let CacheGetUserXP;
	let CacheGetCooldown;
	let CacheSetCooldown;
	let CacheSetWrit;
	let CacheGetWriterWrits;
	let DBUpdateXP;
	let changeRole;
	let sendInteractionReply;
	let messageChannel;
	let handlers;
	let client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupEmperorBotEvents } = require('../../role_commands/emperor_commands'));
		({ CacheGetUserXP, CacheGetCooldown, CacheSetCooldown, CacheSetWrit, CacheGetWriterWrits } = require('../../apis/redis/redisCache'));
		({ DBUpdateXP, changeRole } = require('../../apis/firebase/querys'));
		({ sendInteractionReply, messageChannel } = require('../../functions/botActions'));

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;

		process.env.CHANNELIDEMPEROR = 'ch-emperor';
		process.env.CHANNELID_ROYAL_CASTLE = 'ch-castle';
		process.env.CHANNELID_GREAT_COUNCIL = 'ch-council';

		setupEmperorBotEvents(client, 'msg-id');
	});

	describe('SelectLord', () => {
		test('defers update and fetches selected lord', async () => {
			const interaction = makeInteraction('SelectLord', { isSelect: true, values: ['lord-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('lord-1');
		});
	});

	describe('SelectKing', () => {
		test('defers update and fetches selected king', async () => {
			const interaction = makeInteraction('SelectKing', { isSelect: true, values: ['king-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('king-1');
		});
	});

	describe('Coronation', () => {
		async function selectLord(userId = 'emperor-1', lordId = 'lord-1') {
			const sel = makeInteraction('SelectLord', {
				isSelect: true, userId, values: [lordId],
				fetchedMember: { id: lordId, user: { id: lordId, username: 'Lord1' } },
			});
			await handlers.interactionCreate(sel);
		}

		test('replies with error when no lord selected', async () => {
			await handlers.interactionCreate(makeInteraction('Coronation', { userId: 'new-emperor' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(), 'No lord selected'
			);
		});

		test('replies with not enough drops when XP below cost', async () => {
			CacheGetUserXP.mockResolvedValue(100); // below CoronationCost of 400
			await selectLord();
			await handlers.interactionCreate(makeInteraction('Coronation', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when on cooldown', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			CacheGetCooldown.mockResolvedValue(120000);
			await selectLord();
			await handlers.interactionCreate(makeInteraction('Coronation', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Coronation is on cooldown and cannot be used'
			);
		});

		test('crowns lord as king: changeRole, deducts XP, sets cooldown, sends messages', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			CacheGetCooldown.mockResolvedValue(null);
			const lordMember = { id: 'lord-1', user: { id: 'lord-1', username: 'Lord1' } };
			const sel = makeInteraction('SelectLord', {
				isSelect: true, userId: 'emperor-1', values: ['lord-1'],
				fetchedMember: lordMember,
			});
			await handlers.interactionCreate(sel);
			await handlers.interactionCreate(makeInteraction('Coronation', { userId: 'emperor-1' }));

			expect(changeRole).toHaveBeenCalledWith(lordMember, 'King', true);
			expect(DBUpdateXP).toHaveBeenCalledWith('emperor-1', -400, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('coronation', null, 120000);
			expect(messageChannel).toHaveBeenCalledTimes(2);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('was crowned as king')
			);
		});
	});

	describe('Dethrone', () => {
		async function selectKing(userId = 'emperor-1', kingId = 'king-1') {
			const sel = makeInteraction('SelectKing', {
				isSelect: true, userId, values: [kingId],
				fetchedMember: { id: kingId, user: { id: kingId, username: 'King1' } },
			});
			await handlers.interactionCreate(sel);
		}

		test('replies with error when no king selected', async () => {
			await handlers.interactionCreate(makeInteraction('Dethrone', { userId: 'new-emperor' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(), 'No king selected.'
			);
		});

		test('replies with not enough drops when XP below cost', async () => {
			CacheGetUserXP.mockResolvedValue(100);
			await selectKing();
			await handlers.interactionCreate(makeInteraction('Dethrone', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when on cooldown', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			CacheGetCooldown.mockResolvedValue(120000);
			await selectKing();
			await handlers.interactionCreate(makeInteraction('Dethrone', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Dethrone is on cooldown and cannot be used'
			);
		});

		test('demotes king to lord: changeRole, deducts XP, sets cooldown, sends 2 messages', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			CacheGetCooldown.mockResolvedValue(null);
			const kingMember = { id: 'king-1', user: { id: 'king-1', username: 'King1' } };
			const sel = makeInteraction('SelectKing', {
				isSelect: true, userId: 'emperor-1', values: ['king-1'],
				fetchedMember: kingMember,
			});
			await handlers.interactionCreate(sel);
			await handlers.interactionCreate(makeInteraction('Dethrone', { userId: 'emperor-1' }));

			expect(changeRole).toHaveBeenCalledWith(kingMember, 'Lord', false);
			expect(DBUpdateXP).toHaveBeenCalledWith('emperor-1', -400, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('dethrone', null, 120000);
			expect(messageChannel).toHaveBeenCalledTimes(2);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('has been reduced to lord')
			);
		});
	});

	describe('HeirSuccession', () => {
		async function selectKing(userId = 'emperor-1', kingId = 'heir-1') {
			const sel = makeInteraction('SelectKing', {
				isSelect: true, userId, values: [kingId],
				fetchedMember: { id: kingId, user: { id: kingId, username: 'Heir1' } },
			});
			await handlers.interactionCreate(sel);
		}

		test('replies with error when no king/heir selected', async () => {
			await handlers.interactionCreate(makeInteraction('HeirSuccession', { userId: 'new-emperor' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(), 'No heir selected'
			);
		});

		test('replies with not enough drops when XP below cost', async () => {
			CacheGetUserXP.mockResolvedValue(100);
			await selectKing();
			await handlers.interactionCreate(makeInteraction('HeirSuccession', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when on cooldown', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			CacheGetCooldown.mockResolvedValue(120000);
			await selectKing();
			await handlers.interactionCreate(makeInteraction('HeirSuccession', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Heir Succession is on cooldown and cannot be used'
			);
		});

		test('triggers succession: sends reply, changes role, deducts XP', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			CacheGetCooldown.mockResolvedValue(null);
			const heirMember = { id: 'heir-1', user: { id: 'heir-1', username: 'Heir1' } };
			const sel = makeInteraction('SelectKing', {
				isSelect: true, userId: 'emperor-1', values: ['heir-1'],
				fetchedMember: heirMember,
			});
			await handlers.interactionCreate(sel);

			const empMember = { id: 'emperor-1' };
			await handlers.interactionCreate(
				makeInteraction('HeirSuccession', { userId: 'emperor-1', member: empMember })
			);

			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('enthronement in progress')
			);
			expect(DBUpdateXP).toHaveBeenCalledWith('emperor-1', -400, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('heirSuccession', null, 120000);
		});
	});

	describe('ImperialWrit button', () => {
		async function selectHumanAndKnight(userId = 'emperor-1', humanId = 'h1', knightId = 'k1') {
			await handlers.interactionCreate(makeInteraction('SelectHuman', {
				isSelect: true, userId, values: [humanId],
				fetchedMember: { id: humanId, user: { id: humanId, username: 'Human1' } },
			}));
			await handlers.interactionCreate(makeInteraction('SelectKnight', {
				isSelect: true, userId, values: [knightId],
				fetchedMember: { id: knightId, user: { id: knightId, username: 'Knight1' } },
			}));
		}

		test('replies with error when no knight or target selected', async () => {
			await handlers.interactionCreate(makeInteraction('ImperialWrit', { userId: 'new-emp' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(), 'No knight or target selected.'
			);
		});

		test('replies with cooldown message when on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(120000);
			await selectHumanAndKnight();
			await handlers.interactionCreate(makeInteraction('ImperialWrit', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Imperial Writ is on cooldown and cannot be used.'
			);
		});

		test('replies with error when knight and target are the same person', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			// Select same person as both human and knight
			await handlers.interactionCreate(makeInteraction('SelectHuman', {
				isSelect: true, userId: 'emperor-1', values: ['same-person'],
				fetchedMember: { id: 'same-person', user: { id: 'same-person', username: 'Same' } },
			}));
			await handlers.interactionCreate(makeInteraction('SelectKnight', {
				isSelect: true, userId: 'emperor-1', values: ['same-person'],
				fetchedMember: { id: 'same-person', user: { id: 'same-person', username: 'Same' } },
			}));
			await handlers.interactionCreate(makeInteraction('ImperialWrit', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You cannot target the same person as both knight and target.'
			);
		});

		test('shows modal when selections are valid and no cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			await selectHumanAndKnight('emperor-1', 'h1', 'k1');
			const interaction = makeInteraction('ImperialWrit', { userId: 'emperor-1' });
			await handlers.interactionCreate(interaction);
			expect(interaction.showModal).toHaveBeenCalled();
		});
	});

	describe('ImperialWritModal submission', () => {
		async function selectHumanAndKnight(userId = 'emperor-1') {
			await handlers.interactionCreate(makeInteraction('SelectHuman', {
				isSelect: true, userId, values: ['h1'],
				fetchedMember: { id: 'h1', user: { id: 'h1', username: 'Human1' } },
			}));
			await handlers.interactionCreate(makeInteraction('SelectKnight', {
				isSelect: true, userId, values: ['k1'],
				fetchedMember: { id: 'k1', user: { id: 'k1', username: 'Knight1' } },
			}));
		}

		test('replies with error for non-numeric amount', async () => {
			await selectHumanAndKnight();
			const interaction = makeInteraction('ImperialWritModal', {
				isModal: true, userId: 'emperor-1',
				getTextInputValue: jest.fn()
					.mockReturnValueOnce('message')
					.mockReturnValueOnce('not-a-number'),
			});
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Invalid amount of drops. Please enter a positive number.'
			);
		});

		test('replies with error for zero amount', async () => {
			await selectHumanAndKnight();
			const interaction = makeInteraction('ImperialWritModal', {
				isModal: true, userId: 'emperor-1',
				getTextInputValue: jest.fn()
					.mockReturnValueOnce('message')
					.mockReturnValueOnce('0'),
			});
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'Invalid amount of drops. Please enter a positive number.'
			);
		});

		test('replies with error when not enough XP', async () => {
			CacheGetUserXP.mockResolvedValue(50);
			await selectHumanAndKnight();
			const interaction = makeInteraction('ImperialWritModal', {
				isModal: true, userId: 'emperor-1',
				getTextInputValue: jest.fn()
					.mockReturnValueOnce('message')
					.mockReturnValueOnce('500'),
			});
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining("don't have enough drops")
			);
		});

		test('creates writ, deducts XP, sets cooldown on success', async () => {
			CacheGetUserXP.mockResolvedValue(1000);
			await selectHumanAndKnight();
			const interaction = makeInteraction('ImperialWritModal', {
				isModal: true, userId: 'emperor-1',
				getTextInputValue: jest.fn()
					.mockReturnValueOnce('Execute them')
					.mockReturnValueOnce('300'),
			});
			await handlers.interactionCreate(interaction);
			expect(CacheSetWrit).toHaveBeenCalledWith(4, 'emperor-1', 'k1', 'h1', 0, 'Execute them', 300);
			expect(DBUpdateXP).toHaveBeenCalledWith('emperor-1', -300, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('ImperialWrit', 'emperor-1', 120000);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('Imperial Writ of execution succesfully emitted')
			);
		});
	});

	describe('ShowWrits', () => {
		test('replies with no writs message', async () => {
			CacheGetWriterWrits.mockResolvedValue([]);
			await handlers.interactionCreate(makeInteraction('ShowWrits', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				'You have not issued any writs.'
			);
		});

		test('replies with writ list when writs exist', async () => {
			CacheGetWriterWrits.mockResolvedValue([
				{ knightId: 'k1', targetId: 't1', writStatus: 1, writMessage: 'done', writAmount: 200 },
			]);
			await handlers.interactionCreate(makeInteraction('ShowWrits', { userId: 'emperor-1' }));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('Your issued writs')
			);
		});
	});

	describe('interaction filter', () => {
		test('returns early when not a button, select menu, or modal', async () => {
			const interaction = {
				customId: 'Coronation',
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
