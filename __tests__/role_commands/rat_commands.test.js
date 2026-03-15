jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
	CacheGetUserXP: jest.fn().mockResolvedValue(1000),
	CacheGetCooldown: jest.fn().mockResolvedValue(null),
	CacheSetCooldown: jest.fn().mockResolvedValue(),
}));

jest.mock('../../apis/firebase/querys', () => ({
	DBUpdateXP: jest.fn().mockResolvedValue(),
	changeRole: jest.fn().mockResolvedValue(),
}));

jest.mock('../../game_config.json', () => ({
	NibbleCost: 100,
	NibbleCooldown: 1200000,
	PlagueCooldown: 1200000,
	PlagueFirstPhaseTime: 30000,
	PlagueSecondPhaseTime: 30000,
	PlagueKillSubhuman: 1,
	PlagueKillPeasant: 1,
	PlagueKillScholar: 1,
	PlagueKillMerchant: 1,
	PlagueKillKnight: 1,
	PLAGUETHRESHOLD: 2,
	RoleChangeMessageDisplayTime: 5000,
	TextRatMessageContent: 'rat content',
	ButtonLabelNibble: 'Nibble',
	ButtonLabelPlague: 'Plague',
	ButtonLabelJoinPlague: 'Join Plague',
	TextNibbleSelectMenu: 'Select Nibble Target',
	TextPlagueTargetSelectMenu: 'Select Plague Target',
}));

jest.mock('../../functions/botActions.js', () => ({
	buildSelectMenu: jest.fn().mockResolvedValue({
		setCustomId: jest.fn().mockReturnThis(),
		setPlaceholder: jest.fn().mockReturnThis(),
		setDisabled: jest.fn().mockReturnThis(),
		addOptions: jest.fn().mockReturnThis(),
	}),
	sendInteractionReply: jest.fn().mockResolvedValue(),
	messageChannel: jest.fn().mockResolvedValue(),
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
		components: Array(3).fill(null).map(() => ({
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
		roles: { cache: { has: jest.fn().mockReturnValue(false) } },
	};
	return {
		customId,
		user: { id: opts.userId || 'user-1', username: opts.username || 'TestUser' },
		replied: false,
		deferred: false,
		reply: jest.fn().mockResolvedValue({}),
		deferUpdate: jest.fn().mockResolvedValue({}),
		values: opts.values || ['target-1'],
		guild: { members: { fetch: jest.fn().mockResolvedValue(fetchedMember) } },
		isStringSelectMenu: () => opts.isSelect === true,
		isButton: () => opts.isSelect !== true,
		isModalSubmit: () => false,
	};
}

describe('rat_commands interactions', () => {
	let setupRatBotEvents;
	let CacheGetUserXP;
	let CacheGetCooldown;
	let CacheSetCooldown;
	let CacheGetUsersByRoles;
	let DBUpdateXP;
	let changeRole;
	let eventEmitter;
	let sendInteractionReply;
	let handlers;
	let client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupRatBotEvents } = require('../../role_commands/rat_commands'));
		({ CacheGetUserXP, CacheGetCooldown, CacheSetCooldown, CacheGetUsersByRoles } = require('../../apis/redis/redisCache'));
		({ DBUpdateXP, changeRole } = require('../../apis/firebase/querys'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));
		({ sendInteractionReply } = require('../../functions/botActions.js'));

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;
		setupRatBotEvents(client, 'msg-id');
	});

	describe('SelectNibbleUser', () => {
		test('fetches selected member and defers update', async () => {
			const interaction = makeInteraction('SelectNibbleUser', { isSelect: true, values: ['maggot-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('maggot-1');
		});
	});

	describe('SelectPlagueTarget', () => {
		test('fetches selected member and defers update', async () => {
			const interaction = makeInteraction('SelectPlagueTarget', { isSelect: true, values: ['sub-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('sub-1');
		});
	});

	describe('Nibble', () => {
		test('replies with no target when none selected', async () => {
			const interaction = makeInteraction('Nibble', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No maggot or rat selected')
			);
		});

		test('replies with not enough drops when XP is below cost', async () => {
			CacheGetUserXP.mockResolvedValue(50); // below NibbleCost of 100
			const target = { id: 'maggot-1', user: { id: 'maggot-1', username: 'Maggot' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectNibbleUser', {
				isSelect: true, userId: 'user-1', values: ['maggot-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Nibble', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when nibble is on cooldown', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(1200000);

			const target = { id: 'maggot-1', user: { id: 'maggot-1', username: 'Maggot' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectNibbleUser', {
				isSelect: true, userId: 'user-1', values: ['maggot-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Nibble', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Nibble is on cooldown and cannot be used'
			);
		});

		test('executes nibble: changes role, deducts XP, sets cooldown, emits event', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(null);

			const target = { id: 'maggot-1', user: { id: 'maggot-1', username: 'Maggot' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectNibbleUser', {
				isSelect: true, userId: 'user-1', values: ['maggot-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Nibble', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(changeRole).toHaveBeenCalledWith(target, 'Poop', false);
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -100, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('nibble', 'user-1', 1200000);
			expect(eventEmitter.emit).toHaveBeenCalledWith('NibbleComplete', 'maggot-1', 'user-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('eaten')
			);
		});
	});

	describe('Plague', () => {
		test('replies with no member selected when no target picked', async () => {
			const interaction = makeInteraction('Plague', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No member selected'
			);
		});

		test('replies with cooldown message when plague is on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(1200000);

			const target = { id: 'sub-1', user: { id: 'sub-1', username: 'SubHuman' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectPlagueTarget', {
				isSelect: true, userId: 'user-1', values: ['sub-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Plague', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Plague is on cooldown'
			);
		});

		test('initiates plague when target is selected and no cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUsersByRoles.mockResolvedValue([{ id: 'rat-1' }, { id: 'rat-2' }]);

			const target = { id: 'sub-1', user: { id: 'sub-1', username: 'SubHuman' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectPlagueTarget', {
				isSelect: true, userId: 'user-1', values: ['sub-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Plague', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(CacheSetCooldown).toHaveBeenCalledWith('Plague', 'Global', 1200000);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('successfully initiated plague')
			);
		});
	});

	describe('JoinPlague', () => {
		test('replies with no target selected when no plague target picked', async () => {
			// Need active plague first — set it up
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUsersByRoles.mockResolvedValue([{ id: 'rat-1' }, { id: 'rat-2' }]);

			const target = { id: 'sub-1', user: { id: 'sub-1', username: 'SubHuman' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel = makeInteraction('SelectPlagueTarget', {
				isSelect: true, userId: 'rat-1', values: ['sub-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);
			const initiate = makeInteraction('Plague', { userId: 'rat-1' });
			await handlers.interactionCreate(initiate);

			// Now join without selecting a target
			const interaction = makeInteraction('JoinPlague', { userId: 'rat-2' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No target selected'
			);
		});

		test('replies with already joined when user already in plague', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUsersByRoles.mockResolvedValue([{ id: 'rat-1' }, { id: 'rat-2' }, { id: 'rat-3' }]);

			const target = { id: 'sub-1', user: { id: 'sub-1', username: 'SubHuman' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			// Initiator selects and starts plague
			const sel1 = makeInteraction('SelectPlagueTarget', {
				isSelect: true, userId: 'rat-1', values: ['sub-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel1);
			await handlers.interactionCreate(makeInteraction('Plague', { userId: 'rat-1' }));

			// rat-2 selects a target and joins
			const sel2 = makeInteraction('SelectPlagueTarget', {
				isSelect: true, userId: 'rat-2', values: ['sub-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel2);
			await handlers.interactionCreate(makeInteraction('JoinPlague', { userId: 'rat-2' }));

			// rat-2 tries to join again
			const rejoin = makeInteraction('JoinPlague', { userId: 'rat-2' });
			await handlers.interactionCreate(rejoin);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				rejoin,
				"You've already joined the plague."
			);
		});

		test('joins plague successfully when target selected and not already joined', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUsersByRoles.mockResolvedValue([{ id: 'rat-1' }, { id: 'rat-2' }, { id: 'rat-3' }]);

			const target = { id: 'sub-1', user: { id: 'sub-1', username: 'SubHuman' }, roles: { cache: { has: jest.fn().mockReturnValue(false) } } };
			const sel1 = makeInteraction('SelectPlagueTarget', {
				isSelect: true, userId: 'rat-1', values: ['sub-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel1);
			await handlers.interactionCreate(makeInteraction('Plague', { userId: 'rat-1' }));

			const sel2 = makeInteraction('SelectPlagueTarget', {
				isSelect: true, userId: 'rat-2', values: ['sub-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel2);

			const join = makeInteraction('JoinPlague', { userId: 'rat-2' });
			await handlers.interactionCreate(join);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				join,
				expect.stringContaining('joined the plague')
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

	describe('NotifyRatChannel event listener', () => {
		test('is registered on eventEmitter', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('NotifyRatChannel', expect.any(Function));
		});
	});

	describe('ServerStatusChange event listener', () => {
		test('is registered on eventEmitter', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('ServerStatusChange', expect.any(Function));
		});
	});

	describe('interaction filter', () => {
		test('returns early when interaction is neither button nor select menu', async () => {
			const interaction = {
				customId: 'Nibble',
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
});
