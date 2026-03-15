jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
	CacheIsPoopBeingFestered: jest.fn().mockResolvedValue(false),
	CacheGetFesterCooldown: jest.fn().mockResolvedValue(null),
	CacheGetFesteringTarget: jest.fn().mockResolvedValue(null),
	CacheGetUserXP: jest.fn().mockResolvedValue(1000),
}));

jest.mock('../../apis/firebase/querys', () => ({
	DBUpdateXP: jest.fn().mockResolvedValue(),
	DBSetFestering: jest.fn().mockResolvedValue(),
	DBClearFestering: jest.fn().mockResolvedValue(),
	DBGetUserById: jest.fn().mockResolvedValue({ XP: 500 }),
}));

jest.mock('../../game_config.json', () => ({
	FesterCost: 200,
	ButtonLabelFester: 'Fester',
	TextMaggotMessageContent: 'maggot content',
	TextFesterSelectMenu: 'Select a poop',
	TextFesterEmptySelectMenu: 'No poops available',
}));

jest.mock('../../functions/botActions.js', () => ({
	sendInteractionReply: jest.fn().mockResolvedValue(),
}));

jest.mock('../../functions/eventEmitter.js', () => ({
	eventEmitter: { emit: jest.fn(), on: jest.fn() },
}));

jest.mock('../../game_state.js', () => ({
	isServerDown: jest.fn().mockReturnValue(false),
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
		guilds: { fetch: jest.fn().mockResolvedValue({
			members: { fetch: jest.fn().mockResolvedValue({ id: 'user-1' }) },
		}) },
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
			getTextInputValue: jest.fn().mockImplementation((key) => opts.fields?.[key] ?? ''),
		},
		guild: { members: { fetch: jest.fn().mockResolvedValue(fetchedMember) } },
		client: { users: { fetch: jest.fn().mockResolvedValue({ id: 'u1', username: 'User' }) } },
		isStringSelectMenu: () => opts.isSelect === true,
		isButton: () => opts.isSelect !== true && opts.isModal !== true,
		isModalSubmit: () => opts.isModal === true,
	};
}

describe('maggot_commands', () => {
	let setupMaggotBotEvents, messageMaggotCommands;
	let redisCache, firebase, botActions, eventEmitterMod;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		jest.mock('../../apis/redis/redisCache', () => ({
			CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
			CacheIsPoopBeingFestered: jest.fn().mockResolvedValue(false),
			CacheGetFesterCooldown: jest.fn().mockResolvedValue(null),
			CacheGetFesteringTarget: jest.fn().mockResolvedValue(null),
			CacheGetUserXP: jest.fn().mockResolvedValue(1000),
		}));

		jest.mock('../../apis/firebase/querys', () => ({
			DBUpdateXP: jest.fn().mockResolvedValue(),
			DBSetFestering: jest.fn().mockResolvedValue(),
			DBClearFestering: jest.fn().mockResolvedValue(),
			DBGetUserById: jest.fn().mockResolvedValue({ XP: 500 }),
		}));

		jest.mock('../../game_config.json', () => ({
			FesterCost: 200,
			ButtonLabelFester: 'Fester',
			TextMaggotMessageContent: 'maggot content',
			TextFesterSelectMenu: 'Select a poop',
			TextFesterEmptySelectMenu: 'No poops available',
		}));

		jest.mock('../../functions/botActions.js', () => ({
			sendInteractionReply: jest.fn().mockResolvedValue(),
		}));

		jest.mock('../../functions/eventEmitter.js', () => ({
			eventEmitter: { emit: jest.fn(), on: jest.fn() },
		}));

		jest.mock('../../game_state.js', () => ({
			isServerDown: jest.fn().mockReturnValue(false),
		}));

		({ setupMaggotBotEvents, messageMaggotCommands } = require('../../role_commands/maggot_commands'));
		redisCache = require('../../apis/redis/redisCache');
		firebase = require('../../apis/firebase/querys');
		botActions = require('../../functions/botActions.js');
		eventEmitterMod = require('../../functions/eventEmitter.js');
	});

	describe('setupMaggotBotEvents - event registration', () => {
		it('registers guildMemberAdd, guildMemberRemove, guildMemberUpdate, and interactionCreate handlers', async () => {
			const { client } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');
			expect(client.on).toHaveBeenCalledWith('guildMemberAdd', expect.any(Function));
			expect(client.on).toHaveBeenCalledWith('guildMemberRemove', expect.any(Function));
			expect(client.on).toHaveBeenCalledWith('guildMemberUpdate', expect.any(Function));
			expect(client.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
		});

		it('registers a ServerStatusChange event listener on the eventEmitter', async () => {
			const { client } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');
			expect(eventEmitterMod.eventEmitter.on).toHaveBeenCalledWith('ServerStatusChange', expect.any(Function));
		});
	});

	describe('interactionCreate - filter', () => {
		it('returns early when interaction is neither button nor select menu', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');
			const interaction = makeInteraction('fester', { isModal: true });
			await handlers['interactionCreate'](interaction);
			expect(botActions.sendInteractionReply).not.toHaveBeenCalled();
		});
	});

	describe('interactionCreate - selectPoop', () => {
		it('fetches the selected poop member and calls deferUpdate', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');
			const interaction = makeInteraction('selectPoop', { isSelect: true, values: ['poop-1'] });
			await handlers['interactionCreate'](interaction);
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('poop-1');
			expect(interaction.deferUpdate).toHaveBeenCalled();
		});
	});

	describe('interactionCreate - fester button', () => {
		it('replies with error when no poop has been selected', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');
			const interaction = makeInteraction('fester', { userId: 'no-selection-user' });
			await handlers['interactionCreate'](interaction);
			expect(botActions.sendInteractionReply).toHaveBeenCalledWith(interaction, 'You must select a poop.');
		});

		it('replies with not-enough-drops message when XP is below FesterCost', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			// Select a poop first
			const selectInteraction = makeInteraction('selectPoop', { isSelect: true, values: ['poop-1'], userId: 'user-1' });
			await handlers['interactionCreate'](selectInteraction);

			redisCache.CacheGetUserXP.mockResolvedValue(50); // below FesterCost: 200

			const festerInteraction = makeInteraction('fester', { userId: 'user-1' });
			await handlers['interactionCreate'](festerInteraction);
			expect(botActions.sendInteractionReply).toHaveBeenCalledWith(
				festerInteraction,
				expect.stringContaining('Not enough drops')
			);
		});

		it('replies with cooldown message when fester is on cooldown', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			const selectInteraction = makeInteraction('selectPoop', { isSelect: true, values: ['poop-1'], userId: 'user-1' });
			await handlers['interactionCreate'](selectInteraction);

			redisCache.CacheGetFesterCooldown.mockResolvedValue(99999);

			const festerInteraction = makeInteraction('fester', { userId: 'user-1' });
			await handlers['interactionCreate'](festerInteraction);
			expect(botActions.sendInteractionReply).toHaveBeenCalledWith(
				festerInteraction,
				'Fester is on cooldown and cannot be used.'
			);
		});

		it('replies with already-festered message when target poop is already being festered', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			const selectInteraction = makeInteraction('selectPoop', { isSelect: true, values: ['poop-1'], userId: 'user-1' });
			await handlers['interactionCreate'](selectInteraction);

			redisCache.CacheGetFesterCooldown.mockResolvedValue(null);
			redisCache.CacheIsPoopBeingFestered.mockResolvedValue({ maggotId: 'other-maggot' });

			const festerInteraction = makeInteraction('fester', { userId: 'user-1' });
			await handlers['interactionCreate'](festerInteraction);
			expect(botActions.sendInteractionReply).toHaveBeenCalledWith(festerInteraction, 'Poop already festered.');
		});

		it('calls DBSetFestering, emits notifyFesterTarget, and sends success reply on valid fester', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			const fetchedMember = {
				id: 'poop-1',
				user: { username: 'PoopUser', id: 'poop-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			const selectInteraction = makeInteraction('selectPoop', {
				isSelect: true,
				values: ['poop-1'],
				userId: 'user-1',
				fetchedMember,
			});
			await handlers['interactionCreate'](selectInteraction);

			redisCache.CacheGetFesterCooldown.mockResolvedValue(null);
			redisCache.CacheIsPoopBeingFestered.mockResolvedValue(false);

			const festerInteraction = makeInteraction('fester', { userId: 'user-1' });
			await handlers['interactionCreate'](festerInteraction);

			expect(firebase.DBSetFestering).toHaveBeenCalled();
			expect(eventEmitterMod.eventEmitter.emit).toHaveBeenCalledWith('notifyFesterTarget', 'poop-1');
			expect(botActions.sendInteractionReply).toHaveBeenCalledWith(
				festerInteraction,
				expect.stringContaining('Successfully latched on to poop')
			);
		});

		it('deducts XP from both maggot and poop on successful fester', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			const fetchedMember = {
				id: 'poop-1',
				user: { username: 'PoopUser', id: 'poop-1' },
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			const selectInteraction = makeInteraction('selectPoop', {
				isSelect: true,
				values: ['poop-1'],
				userId: 'user-1',
				fetchedMember,
			});
			await handlers['interactionCreate'](selectInteraction);

			redisCache.CacheGetFesterCooldown.mockResolvedValue(null);
			redisCache.CacheIsPoopBeingFestered.mockResolvedValue(false);
			firebase.DBGetUserById.mockResolvedValue({ XP: 400 });

			const festerInteraction = makeInteraction('fester', { userId: 'user-1' });
			await handlers['interactionCreate'](festerInteraction);

			// DBUpdateXP called: -FesterCost for maggot, +half poop XP for maggot, -half poop XP for poop
			expect(firebase.DBUpdateXP).toHaveBeenCalledWith('user-1', -200, client);
			expect(firebase.DBUpdateXP).toHaveBeenCalledWith('user-1', 200, client);
			expect(firebase.DBUpdateXP).toHaveBeenCalledWith('poop-1', -200, client);
		});
	});

	describe('guildMemberRemove handler', () => {
		it('clears festering data when the removed member was being festered', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			redisCache.CacheIsPoopBeingFestered.mockResolvedValue({ maggotId: 'maggot-1' });
			const member = { id: 'poop-1', roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			await handlers['guildMemberRemove'](member);
			expect(firebase.DBClearFestering).toHaveBeenCalledWith('maggot-1');
		});

		it('does not call DBClearFestering when the removed member was not being festered', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			redisCache.CacheIsPoopBeingFestered.mockResolvedValue(false);
			const member = { id: 'poop-1', roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			await handlers['guildMemberRemove'](member);
			expect(firebase.DBClearFestering).not.toHaveBeenCalled();
		});
	});

	describe('guildMemberUpdate handler', () => {
		it('clears festering when a maggot loses their maggot role and has an active target', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			redisCache.CacheGetFesteringTarget.mockResolvedValue('poop-1');
			const oldMember = {
				id: 'maggot-1',
				user: { username: 'Maggot' },
				roles: { cache: { has: jest.fn().mockImplementation((id) => id === process.env.ROLEID_MAGGOT) } },
			};
			const newMember = {
				id: 'maggot-1',
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['guildMemberUpdate'](oldMember, newMember);
			expect(firebase.DBClearFestering).toHaveBeenCalledWith('maggot-1');
		});

		it('does not clear festering when there is no active festering target on role change', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			redisCache.CacheGetFesteringTarget.mockResolvedValue(null);
			const oldMember = {
				id: 'maggot-1',
				user: { username: 'Maggot' },
				roles: { cache: { has: jest.fn().mockImplementation((id) => id === process.env.ROLEID_MAGGOT) } },
			};
			const newMember = {
				id: 'maggot-1',
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['guildMemberUpdate'](oldMember, newMember);
			expect(firebase.DBClearFestering).not.toHaveBeenCalled();
		});

		it('clears festering for the maggot when a poop loses their role and was being festered', async () => {
			const { client, handlers } = makeMockClient();
			await setupMaggotBotEvents(client, 'msg-1');

			redisCache.CacheIsPoopBeingFestered.mockResolvedValue('maggot-99');
			const oldMember = {
				id: 'poop-1',
				user: { username: 'Poop' },
				roles: { cache: { has: jest.fn().mockImplementation((id) => id === process.env.ROLEID_POOP) } },
			};
			const newMember = {
				id: 'poop-1',
				roles: { cache: { has: jest.fn().mockReturnValue(false) } },
			};
			await handlers['guildMemberUpdate'](oldMember, newMember);
			expect(firebase.DBClearFestering).toHaveBeenCalledWith('maggot-99');
		});
	});

	describe('messageMaggotCommands', () => {
		it('fetches the maggot channel and sends a message with button and select-menu components', async () => {
			const { client, mockChannel } = makeMockClient();
			await messageMaggotCommands(client);
			expect(client.channels.fetch).toHaveBeenCalled();
			expect(mockChannel.send).toHaveBeenCalledWith(
				expect.objectContaining({ components: expect.any(Array) })
			);
		});

		it('includes server-down text in message content when server is down', async () => {
			const gameState = require('../../game_state.js');
			gameState.isServerDown.mockReturnValue(true);

			const { client, mockChannel } = makeMockClient();
			await messageMaggotCommands(client);
			const callArg = mockChannel.send.mock.calls[0][0];
			expect(callArg.content).toContain('SERVER IS DOWN');
		});
	});
});
