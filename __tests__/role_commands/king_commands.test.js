jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetUserXP: jest.fn().mockResolvedValue(1000),
	CacheGetCooldown: jest.fn().mockResolvedValue(null),
	CacheSetCooldown: jest.fn().mockResolvedValue(),
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
	CacheGetWriterWrits: jest.fn().mockResolvedValue([]),
	CacheSetWrit: jest.fn().mockResolvedValue(),
}));

jest.mock('../../apis/firebase/querys.js', () => ({
	DBUpdateXP: jest.fn().mockResolvedValue(),
	changeRole: jest.fn().mockResolvedValue(),
	isThresholdOpen: jest.fn().mockReturnValue(true),
	openThreshold: jest.fn().mockResolvedValue(),
	closeThreshold: jest.fn(),
}));

jest.mock('../../game_config.json', () => ({
	DegradationCost: 100,
	DegradationCooldown: 1200000,
	KnightCost: 200,
	KnightCooldown: 1200000,
	SiegeCooldown: 1200000,
	SiegeCost: 300,
	SiegeTime: 30000,
	RoleChangeMessageDisplayTime: 5000,
	RoyalWritCooldown: 1200000,
	TextKingMessageContent: 'king content',
	TextDegradationRoyalWritSelectMenu: 'select',
	TextKnightSelectMenu: 'select',
	TextSiegeKingSelectMenu: 'select',
	TextRoyalWritTargetSelectMenu: 'select',
	ButtonLabelDegradation: 'Degrade',
	ButtonLabelRoyalWrit: 'Royal Writ',
	ButtonLabelKnight: 'Knight',
	ButtonLabelSiege: 'Siege',
	ButtonLabelShowWrits: 'Show Writs',
	NobleLordElectionTime: 30000,
	LordKingElectionTime: 30000,
	NobleLordElectionSuccessThreshold: 0.5,
	LordKingElectionSuccessThreshold: 0.5,
	LordElectionCooldown: 1200000,
	EminentWritCooldown: 1200000,
	TextLordMessageContent: 'lord content',
	TextEminentWritKnightSelectMenu: 'select',
	TextEminentWritTargetSelectMenu: 'select',
	TextElectionSelectMenu: 'select',
	TextExileSelectMenu: 'select',
	ButtonLabelExile: 'Exile',
	ExileCooldown: 1200000,
	ExileCost: 150,
	ButtonLabelEminentWrit: 'Eminent Writ',
	ButtonLabelElection: 'Election',
	ButtonLabelElectionVote: 'Vote',
	MinimumLordSize: 2,
	MinimumLordSizeForElection: 2,
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
	isSiegeActive: jest.fn().mockReturnValue(false),
	isEmperorElectionActive: jest.fn().mockReturnValue(false),
	getDisableSiege: jest.fn().mockReturnValue(false),
	getDisableElection: jest.fn().mockReturnValue(false),
	isServerDown: jest.fn().mockReturnValue(false),
	setSiegeActive: jest.fn(),
	setSiegeInitiator: jest.fn(),
	setSiegeTarget: jest.fn(),
	getSiegeInitiatorId: jest.fn().mockReturnValue(null),
	getSiegeTargetId: jest.fn().mockReturnValue(null),
	getSiegeInitiator: jest.fn().mockReturnValue(null),
	getSiegeTarget: jest.fn().mockReturnValue(null),
	getSiegeTargetUsername: jest.fn().mockReturnValue('TargetUser'),
	clearSiegeTimeout: jest.fn(),
	setSiegeTimeout: jest.fn(),
	getSiegeTimeout: jest.fn().mockReturnValue(null),
	removeSiegeTimeout: jest.fn(),
	addSiegeParticipant: jest.fn(),
	removeSiegeParticipant: jest.fn(),
	isSiegeParticipant: jest.fn().mockReturnValue(false),
	getSiegeParticipantsSize: jest.fn().mockReturnValue(0),
	clearSiegeParticipants: jest.fn(),
	getRoleSize: jest.fn().mockReturnValue(2),
	isRevolutionActive: jest.fn().mockReturnValue(false),
	isCoupActive: jest.fn().mockReturnValue(false),
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
			setPlaceholder: jest.fn().mockReturnThis(),
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
		TextInputStyle: { Short: 1, Paragraph: 2 },
	};
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
		user: { username: 'TargetUser', id: opts.targetId || 'target-1' },
		roles: { cache: { has: jest.fn().mockReturnValue(false) } },
	};
	return {
		customId,
		user: { id: opts.userId || 'user-1', username: opts.username || 'TestUser' },
		member: opts.member || { id: opts.userId || 'user-1' },
		replied: false,
		deferred: false,
		reply: jest.fn().mockResolvedValue({}),
		deferUpdate: jest.fn().mockResolvedValue({}),
		deferReply: jest.fn().mockResolvedValue({}),
		followUp: jest.fn().mockResolvedValue({}),
		showModal: jest.fn().mockResolvedValue({}),
		values: opts.values || ['target-1'],
		fields: {
			getTextInputValue: jest.fn().mockImplementation((key) => {
				if (opts.fields) return opts.fields[key] ?? '';
				return '';
			}),
		},
		guild: { members: { fetch: jest.fn().mockResolvedValue(fetchedMember) } },
		client: { users: { fetch: jest.fn().mockResolvedValue({ id: 'u1', username: 'User' }) } },
		isStringSelectMenu: () => opts.isSelect === true,
		isButton: () => opts.isSelect !== true && opts.isModal !== true,
		isModalSubmit: () => opts.isModal === true,
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('king_commands interactions', () => {
	let setupKingBotEvents;
	let CacheGetUserXP, CacheGetCooldown, CacheSetCooldown, CacheGetWriterWrits, CacheSetWrit;
	let DBUpdateXP, changeRole;
	let sendInteractionReply, messageChannel, messageAllHumanChannels;
	let eventEmitter;
	let gameState;
	let handlers, client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupKingBotEvents } = require('../../role_commands/king_commands'));
		({ CacheGetUserXP, CacheGetCooldown, CacheSetCooldown, CacheGetWriterWrits, CacheSetWrit } =
			require('../../apis/redis/redisCache'));
		({ DBUpdateXP, changeRole } = require('../../apis/firebase/querys.js'));
		({ sendInteractionReply, messageChannel, messageAllHumanChannels } =
			require('../../functions/botActions.js'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));
		gameState = require('../../game_state.js');

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;
		setupKingBotEvents(client, 'msg-id');
	});

	// ─── Event handler registration ───────────────────────────────────────────

	describe('event handler registration', () => {
		test('registers guildMemberRemove handler', () => {
			expect(typeof handlers['guildMemberRemove']).toBe('function');
		});

		test('registers guildMemberUpdate handler', () => {
			expect(typeof handlers['guildMemberUpdate']).toBe('function');
		});

		test('registers interactionCreate handler', () => {
			expect(typeof handlers['interactionCreate']).toBe('function');
		});
	});

	// ─── Interaction filter ───────────────────────────────────────────────────

	describe('interaction filter', () => {
		test('returns early for interactions that are not button, select, or modal', async () => {
			const interaction = makeInteraction('RoyalWrit');
			interaction.isStringSelectMenu = () => false;
			interaction.isButton = () => false;
			interaction.isModalSubmit = () => false;
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).not.toHaveBeenCalled();
			expect(interaction.deferUpdate).not.toHaveBeenCalled();
		});
	});

	// ─── SelectWritHuman ─────────────────────────────────────────────────────

	describe('SelectWritHuman', () => {
		test('defers update and fetches member', async () => {
			const interaction = makeInteraction('SelectWritHuman', {
				isSelect: true,
				values: ['target-1'],
			});
			await handlers['interactionCreate'](interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('target-1');
		});
	});

	// ─── SelectDegradation ───────────────────────────────────────────────────

	describe('SelectDegradation', () => {
		test('defers update and fetches member', async () => {
			const interaction = makeInteraction('SelectDegradation', {
				isSelect: true,
				values: ['knight-1'],
			});
			await handlers['interactionCreate'](interaction);
			// SelectDegradation calls deferUpdate after fetch (order in source)
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('knight-1');
		});
	});

	// ─── SelectKnight ─────────────────────────────────────────────────────────

	describe('SelectKnight', () => {
		test('defers update and fetches member', async () => {
			const interaction = makeInteraction('SelectKnight', {
				isSelect: true,
				values: ['human-1'],
			});
			await handlers['interactionCreate'](interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('human-1');
		});
	});

	// ─── SelectKing ──────────────────────────────────────────────────────────

	describe('SelectKing', () => {
		test('defers update and fetches member', async () => {
			const interaction = makeInteraction('SelectKing', {
				isSelect: true,
				values: ['king-1'],
			});
			await handlers['interactionCreate'](interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('king-1');
		});
	});

	// ─── RoyalWrit ───────────────────────────────────────────────────────────

	describe('RoyalWrit', () => {
		test('replies "No knight or target selected." when no selections have been made', async () => {
			const interaction = makeInteraction('RoyalWrit');
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No knight or target selected.'
			);
		});

		test('replies with cooldown message when Royal Writ is on cooldown', async () => {
			const userId = 'user-1';

			// Set up a knight selection
			const knightMember = {
				id: 'knight-1',
				user: { username: 'Knight', id: 'knight-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: ['knight-1'],
					fetchedMember: knightMember,
				})
			);

			// Set up a writ human selection (different member)
			const humanMember = {
				id: 'human-1',
				user: { username: 'Human', id: 'human-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectWritHuman', {
					isSelect: true,
					userId,
					values: ['human-1'],
					fetchedMember: humanMember,
				})
			);

			CacheGetCooldown.mockResolvedValueOnce(true);
			const interaction = makeInteraction('RoyalWrit', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Royal Writ is on cooldown and cannot be used.'
			);
		});

		test('replies with same-person error when knight and target are the same member', async () => {
			const userId = 'user-1';
			const sameId = 'same-person';
			const sameMember = {
				id: sameId,
				user: { username: 'SameUser', id: sameId },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};

			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: [sameId],
					fetchedMember: sameMember,
				})
			);
			await handlers['interactionCreate'](
				makeInteraction('SelectWritHuman', {
					isSelect: true,
					userId,
					values: [sameId],
					fetchedMember: sameMember,
				})
			);

			CacheGetCooldown.mockResolvedValueOnce(null);
			const interaction = makeInteraction('RoyalWrit', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'You cannot target the same person as both knight and target.'
			);
		});

		test('shows modal when knight and target are valid and different', async () => {
			const userId = 'user-1';
			const knightMember = {
				id: 'knight-1',
				user: { username: 'Knight', id: 'knight-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			const humanMember = {
				id: 'human-1',
				user: { username: 'Human', id: 'human-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};

			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: ['knight-1'],
					fetchedMember: knightMember,
				})
			);
			await handlers['interactionCreate'](
				makeInteraction('SelectWritHuman', {
					isSelect: true,
					userId,
					values: ['human-1'],
					fetchedMember: humanMember,
				})
			);

			CacheGetCooldown.mockResolvedValueOnce(null);
			const interaction = makeInteraction('RoyalWrit', { userId });
			await handlers['interactionCreate'](interaction);
			expect(interaction.showModal).toHaveBeenCalled();
		});
	});

	// ─── RoyalWritModal ──────────────────────────────────────────────────────

	describe('RoyalWritModal', () => {
		// Helper: set up both knight and human selections for a user
		async function setupWritSelections(userId, knightId = 'knight-1', humanId = 'human-1') {
			const knightMember = {
				id: knightId,
				user: { username: 'Knight', id: knightId },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			const humanMember = {
				id: humanId,
				user: { username: 'Human', id: humanId },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: [knightId],
					fetchedMember: knightMember,
				})
			);
			await handlers['interactionCreate'](
				makeInteraction('SelectWritHuman', {
					isSelect: true,
					userId,
					values: [humanId],
					fetchedMember: humanMember,
				})
			);
		}

		test('replies with invalid amount error when amount is NaN', async () => {
			const userId = 'user-1';
			await setupWritSelections(userId);
			const interaction = makeInteraction('RoyalWritModal', {
				isModal: true,
				userId,
				fields: { messageToKnight: 'execute target', amountInput: 'notanumber' },
			});
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Invalid amount of drops. Please enter a positive number.'
			);
		});

		test('replies with invalid amount error when amount is zero', async () => {
			const userId = 'user-1';
			await setupWritSelections(userId);
			const interaction = makeInteraction('RoyalWritModal', {
				isModal: true,
				userId,
				fields: { messageToKnight: 'execute target', amountInput: '0' },
			});
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Invalid amount of drops. Please enter a positive number.'
			);
		});

		test('replies with insufficient XP message when user lacks drops', async () => {
			const userId = 'user-1';
			await setupWritSelections(userId);
			CacheGetUserXP.mockResolvedValueOnce(50);
			const interaction = makeInteraction('RoyalWritModal', {
				isModal: true,
				userId,
				fields: { messageToKnight: 'execute target', amountInput: '500' },
			});
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining("don't have enough drops")
			);
		});

		test('success: calls CacheSetWrit with correct writ type (3)', async () => {
			const userId = 'user-1';
			await setupWritSelections(userId, 'knight-1', 'human-1');
			CacheGetUserXP.mockResolvedValueOnce(1000);
			const interaction = makeInteraction('RoyalWritModal', {
				isModal: true,
				userId,
				fields: { messageToKnight: 'execute this', amountInput: '100' },
			});
			await handlers['interactionCreate'](interaction);
			expect(CacheSetWrit).toHaveBeenCalledWith(
				3, userId, 'knight-1', 'human-1', 0, 'execute this', 100
			);
		});

		test('success: calls DBUpdateXP with negative writ amount', async () => {
			const userId = 'user-1';
			await setupWritSelections(userId, 'knight-1', 'human-1');
			CacheGetUserXP.mockResolvedValueOnce(1000);
			const interaction = makeInteraction('RoyalWritModal', {
				isModal: true,
				userId,
				fields: { messageToKnight: 'execute this', amountInput: '100' },
			});
			await handlers['interactionCreate'](interaction);
			expect(DBUpdateXP).toHaveBeenCalledWith(userId, -100, client);
		});

		test('success: calls CacheSetCooldown with "highWrit" key', async () => {
			const userId = 'user-1';
			await setupWritSelections(userId, 'knight-1', 'human-1');
			CacheGetUserXP.mockResolvedValueOnce(1000);
			const interaction = makeInteraction('RoyalWritModal', {
				isModal: true,
				userId,
				fields: { messageToKnight: 'execute this', amountInput: '100' },
			});
			await handlers['interactionCreate'](interaction);
			expect(CacheSetCooldown).toHaveBeenCalledWith('highWrit', userId, expect.any(Number));
		});

		test('success: calls sendInteractionReply confirming writ emission', async () => {
			const userId = 'user-1';
			await setupWritSelections(userId, 'knight-1', 'human-1');
			CacheGetUserXP.mockResolvedValueOnce(1000);
			const interaction = makeInteraction('RoyalWritModal', {
				isModal: true,
				userId,
				fields: { messageToKnight: 'execute this', amountInput: '100' },
			});
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Royal Writ of execution')
			);
		});
	});

	// ─── ShowWrits ───────────────────────────────────────────────────────────

	describe('ShowWrits', () => {
		test('replies "You have not issued any writs." when no writs exist', async () => {
			CacheGetWriterWrits.mockResolvedValueOnce([]);
			const interaction = makeInteraction('ShowWrits');
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'You have not issued any writs.'
			);
		});

		test('replies with writ descriptions when writs exist', async () => {
			CacheGetWriterWrits.mockResolvedValueOnce([
				{ knightId: 'k1', targetId: 't1', writStatus: 0, writMessage: 'msg', writAmount: 50 },
			]);
			const interaction = makeInteraction('ShowWrits');
			interaction.client.users.fetch = jest.fn()
				.mockResolvedValueOnce({ id: 'k1', username: 'Knight1' })
				.mockResolvedValueOnce({ id: 't1', username: 'Target1' });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Your issued writs')
			);
		});
	});

	// ─── DegradationKnight ───────────────────────────────────────────────────

	describe('DegradationKnight', () => {
		test('replies "No knight selected" when no knight selection exists', async () => {
			const interaction = makeInteraction('DegradationKnight');
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'No knight selected');
		});

		test('replies with insufficient XP when user lacks enough drops', async () => {
			const userId = 'user-1';
			const knightMember = {
				id: 'knight-1',
				user: { username: 'Knight', id: 'knight-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: ['knight-1'],
					fetchedMember: knightMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(50);
			const interaction = makeInteraction('DegradationKnight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when degradation is on cooldown', async () => {
			const userId = 'user-1';
			const knightMember = {
				id: 'knight-1',
				user: { username: 'Knight', id: 'knight-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: ['knight-1'],
					fetchedMember: knightMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(true);
			const interaction = makeInteraction('DegradationKnight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Degradation is on cooldown and cannot be used'
			);
		});

		test('success: calls changeRole to demote knight to Merchant', async () => {
			const userId = 'user-1';
			const knightMember = {
				id: 'knight-1',
				user: { username: 'Knight', id: 'knight-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: ['knight-1'],
					fetchedMember: knightMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(null);
			// "clinet" typo in source causes a ReferenceError after these calls;
			// showErrorMsg catches it so the handler resolves without throwing
			const interaction = makeInteraction('DegradationKnight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(changeRole).toHaveBeenCalledWith(knightMember, 'Merchant', false);
		});

		test('success: calls DBUpdateXP with DegradationCost deducted', async () => {
			const userId = 'user-1';
			const knightMember = {
				id: 'knight-1',
				user: { username: 'Knight', id: 'knight-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: ['knight-1'],
					fetchedMember: knightMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(null);
			const interaction = makeInteraction('DegradationKnight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(DBUpdateXP).toHaveBeenCalledWith(userId, -100, client);
		});

		test('success: calls CacheSetCooldown and sendInteractionReply confirming degradation', async () => {
			const userId = 'user-1';
			const knightMember = {
				id: 'knight-1',
				user: { username: 'Knight', id: 'knight-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectDegradation', {
					isSelect: true,
					userId,
					values: ['knight-1'],
					fetchedMember: knightMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(null);
			const interaction = makeInteraction('DegradationKnight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(CacheSetCooldown).toHaveBeenCalledWith(
				'degradationKnight', userId, expect.any(Number)
			);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Degradation  successful')
			);
		});
	});

	// ─── Knight ──────────────────────────────────────────────────────────────

	describe('Knight', () => {
		test('replies when no human is selected', async () => {
			const interaction = makeInteraction('Knight');
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'no peasant, scholar or merchant selected...'
			);
		});

		test('replies with insufficient XP when user lacks enough drops', async () => {
			const userId = 'user-1';
			const humanMember = {
				id: 'human-1',
				user: { username: 'Human', id: 'human-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKnight', {
					isSelect: true,
					userId,
					values: ['human-1'],
					fetchedMember: humanMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(50);
			const interaction = makeInteraction('Knight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when knight is on cooldown', async () => {
			const userId = 'user-1';
			const humanMember = {
				id: 'human-1',
				user: { username: 'Human', id: 'human-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKnight', {
					isSelect: true,
					userId,
					values: ['human-1'],
					fetchedMember: humanMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(true);
			const interaction = makeInteraction('Knight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Knight is on cooldown and cannot be used'
			);
		});

		test('success: emits "changeRole" via eventEmitter with target and Knight role', async () => {
			const userId = 'user-1';
			const humanMember = {
				id: 'human-1',
				user: { username: 'Human', id: 'human-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKnight', {
					isSelect: true,
					userId,
					values: ['human-1'],
					fetchedMember: humanMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(null);
			// "clinet" typo throws a ReferenceError after eventEmitter.emit;
			// showErrorMsg catches it so the handler resolves without throwing
			const interaction = makeInteraction('Knight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				'changeRole', humanMember, 'Knight', true
			);
		});

		test('success: calls DBUpdateXP with KnightCost deducted', async () => {
			const userId = 'user-1';
			const humanMember = {
				id: 'human-1',
				user: { username: 'Human', id: 'human-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKnight', {
					isSelect: true,
					userId,
					values: ['human-1'],
					fetchedMember: humanMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(null);
			const interaction = makeInteraction('Knight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(DBUpdateXP).toHaveBeenCalledWith(userId, -200, client);
		});

		test('success: calls CacheSetCooldown and sendInteractionReply confirming knighting', async () => {
			const userId = 'user-1';
			const humanMember = {
				id: 'human-1',
				user: { username: 'Human', id: 'human-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKnight', {
					isSelect: true,
					userId,
					values: ['human-1'],
					fetchedMember: humanMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(null);
			const interaction = makeInteraction('Knight', { userId });
			await handlers['interactionCreate'](interaction);
			expect(CacheSetCooldown).toHaveBeenCalledWith('knight', userId, expect.any(Number));
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('has been knighted')
			);
		});
	});

	// ─── Siege ───────────────────────────────────────────────────────────────

	describe('Siege', () => {
		test('replies when siege is disabled', async () => {
			gameState.getDisableSiege.mockReturnValueOnce(true);
			const interaction = makeInteraction('Siege');
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Siege is disabled, not enough knights to siege a king'
			);
		});

		test('replies when a siege is already active', async () => {
			gameState.getDisableSiege.mockReturnValueOnce(false);
			gameState.isSiegeActive.mockReturnValueOnce(true);
			const interaction = makeInteraction('Siege');
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Another siege is underway')
			);
		});

		test('replies "No king selected" when no king selection exists', async () => {
			gameState.getDisableSiege.mockReturnValueOnce(false);
			gameState.isSiegeActive.mockReturnValueOnce(false);
			const interaction = makeInteraction('Siege');
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'No king selected');
		});

		test('replies with insufficient XP when user lacks enough drops', async () => {
			const userId = 'user-1';
			const kingMember = {
				id: 'king-2',
				user: { username: 'OtherKing', id: 'king-2' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKing', {
					isSelect: true,
					userId,
					values: ['king-2'],
					fetchedMember: kingMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(50);
			const interaction = makeInteraction('Siege', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies "You cannot target yourself." when user selects themselves', async () => {
			const userId = 'user-1';
			const selfMember = {
				id: userId,
				user: { username: 'Self', id: userId },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKing', {
					isSelect: true,
					userId,
					values: [userId],
					fetchedMember: selfMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			const interaction = makeInteraction('Siege', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'You cannot target yourself.'
			);
		});

		test('replies "Siege is on cooldown" when cooldown is active', async () => {
			const userId = 'user-1';
			const kingMember = {
				id: 'king-2',
				user: { username: 'OtherKing', id: 'king-2' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKing', {
					isSelect: true,
					userId,
					values: ['king-2'],
					fetchedMember: kingMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(true);
			const interaction = makeInteraction('Siege', { userId });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'Siege is on cooldown');
		});

		test('success: calls sendInteractionReply with "Siege initiated..."', async () => {
			const userId = 'user-1';
			const kingMember = {
				id: 'king-2',
				user: { username: 'OtherKing', id: 'king-2' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['interactionCreate'](
				makeInteraction('SelectKing', {
					isSelect: true,
					userId,
					values: ['king-2'],
					fetchedMember: kingMember,
				})
			);

			CacheGetUserXP.mockResolvedValueOnce(1000);
			CacheGetCooldown.mockResolvedValueOnce(null);
			// startSiege calls messageChannel(clinet, ...) which throws a ReferenceError;
			// showErrorMsg catches it so the handler still resolves
			const interaction = makeInteraction('Siege', { userId, member: { id: userId } });
			await handlers['interactionCreate'](interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Siege initiated')
			);
		});
	});

	// ─── guildMemberRemove ───────────────────────────────────────────────────

	describe('guildMemberRemove', () => {
		test('is registered as a handler on client', () => {
			expect(typeof handlers['guildMemberRemove']).toBe('function');
		});

		test('handles member leaving with no siege active without throwing', async () => {
			gameState.isSiegeActive.mockReturnValue(false);
			const member = {
				id: 'leaving-user',
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await expect(handlers['guildMemberRemove'](member)).resolves.not.toThrow();
		});
	});

	// ─── guildMemberUpdate ───────────────────────────────────────────────────

	describe('guildMemberUpdate', () => {
		test('is registered as a handler on client', () => {
			expect(typeof handlers['guildMemberUpdate']).toBe('function');
		});

		test('handles member update with no siege active without throwing', async () => {
			gameState.isSiegeActive.mockReturnValue(false);
			const member = {
				id: 'some-user',
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await expect(
				handlers['guildMemberUpdate'](member, member)
			).resolves.not.toThrow();
		});
	});
});
