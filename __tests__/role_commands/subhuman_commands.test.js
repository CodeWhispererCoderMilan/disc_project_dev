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
	DepravityCost: 100,
	DepravityCooldown: 1200000,
	ManhuntCost: 100,
	ManhuntCooldown: 1200000,
	PickingCost: 100,
	PickingCooldown: 1200000,
	TextSubhumanMessageContent: 'subhuman content',
	ButtonLabelManhunt: 'Manhunt',
	ButtonLabelDepravity: 'Depravity',
	ButtonLabelPickings: 'Pickings',
	TextPickingsSelectMenu: 'Select Picking',
	TextDepravitySelectMenu: 'Select Sub-human',
	TextManhuntSelectMenu: 'Select Peasant',
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

describe('subhuman_commands interactions', () => {
	let setupSubhumanBotEvents;
	let CacheGetUserXP;
	let CacheGetCooldown;
	let CacheSetCooldown;
	let DBUpdateXP;
	let changeRole;
	let eventEmitter;
	let sendInteractionReply;
	let handlers;
	let client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupSubhumanBotEvents } = require('../../role_commands/subhuman_commands'));
		({ CacheGetUserXP, CacheGetCooldown, CacheSetCooldown } = require('../../apis/redis/redisCache'));
		({ DBUpdateXP, changeRole } = require('../../apis/firebase/querys'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));
		({ sendInteractionReply } = require('../../functions/botActions.js'));

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;
		setupSubhumanBotEvents(client, 'msg-id');
	});

	describe('SelectSubHuman', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectSubHuman', { isSelect: true, values: ['sub-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('sub-1');
		});
	});

	describe('SelectPeasant', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectPeasant', { isSelect: true, values: ['peas-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('peas-1');
		});
	});

	describe('SelectPicking', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectPicking', { isSelect: true, values: ['pick-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('pick-1');
		});
	});

	describe('Depravity', () => {
		test('replies with no sub-human selected when none picked', async () => {
			const interaction = makeInteraction('Depravity', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No sub-human selected')
			);
		});

		test('replies with cannot eat yourself when self-targeting', async () => {
			// Select self
			const selfMember = { id: 'user-1', user: { id: 'user-1', username: 'Self' } };
			const sel = makeInteraction('SelectSubHuman', {
				isSelect: true, userId: 'user-1', values: ['user-1'],
				fetchedMember: selfMember,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Depravity', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('cannot eat yourself')
			);
		});

		test('replies with not enough drops when XP is below cost', async () => {
			CacheGetUserXP.mockResolvedValue(50); // below DepravityCost of 100
			const target = { id: 'target-1', user: { id: 'target-1', username: 'Target' } };
			const sel = makeInteraction('SelectSubHuman', {
				isSelect: true, userId: 'user-1', values: ['target-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Depravity', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when depravity is on cooldown', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(1200000);

			const target = { id: 'target-1', user: { id: 'target-1', username: 'Target' } };
			const sel = makeInteraction('SelectSubHuman', {
				isSelect: true, userId: 'user-1', values: ['target-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Depravity', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Depravity is on cooldown and cannot be used'
			);
		});

		test('executes depravity: changes role, deducts XP, sets cooldown, emits event', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(null);

			const target = { id: 'target-1', user: { id: 'target-1', username: 'Target' } };
			const sel = makeInteraction('SelectSubHuman', {
				isSelect: true, userId: 'user-1', values: ['target-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Depravity', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(changeRole).toHaveBeenCalledWith(target, 'Poop', false);
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -100, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('depravity', 'user-1', 1200000);
			expect(eventEmitter.emit).toHaveBeenCalledWith('DepravityComplete', 'target-1', 'user-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('eaten your own kind')
			);
		});
	});

	describe('Manhunt', () => {
		test('replies with no peasant selected when none picked', async () => {
			const interaction = makeInteraction('Manhunt', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No peasant selected')
			);
		});

		test('replies with not enough drops when XP is below cost', async () => {
			CacheGetUserXP.mockResolvedValue(50);
			const target = { id: 'peas-1', user: { id: 'peas-1', username: 'Peasant' } };
			const sel = makeInteraction('SelectPeasant', {
				isSelect: true, userId: 'user-1', values: ['peas-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Manhunt', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when manhunt is on cooldown', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(1200000);

			const target = { id: 'peas-1', user: { id: 'peas-1', username: 'Peasant' } };
			const sel = makeInteraction('SelectPeasant', {
				isSelect: true, userId: 'user-1', values: ['peas-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Manhunt', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('cooldown')
			);
		});

		test('executes manhunt: changes role, deducts XP, sets cooldown, emits event', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(null);

			const target = { id: 'peas-1', user: { id: 'peas-1', username: 'Peasant' } };
			const sel = makeInteraction('SelectPeasant', {
				isSelect: true, userId: 'user-1', values: ['peas-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Manhunt', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(changeRole).toHaveBeenCalledWith(target, 'Poop', false);
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -100, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('manhunt', 'user-1', 1200000);
			expect(eventEmitter.emit).toHaveBeenCalledWith('ManhuntComplete', 'peas-1', 'user-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('killed a scrambling peasant')
			);
		});
	});

	describe('Picking', () => {
		test('replies with no rat or maggot selected when none picked', async () => {
			const interaction = makeInteraction('Picking', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No rat or maggot selected')
			);
		});

		test('replies with not enough drops when XP is below cost', async () => {
			CacheGetUserXP.mockResolvedValue(50);
			const target = { id: 'rat-1', user: { id: 'rat-1', username: 'Rat' } };
			const sel = makeInteraction('SelectPicking', {
				isSelect: true, userId: 'user-1', values: ['rat-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Picking', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('replies with cooldown message when picking is on cooldown', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(1200000);

			const target = { id: 'rat-1', user: { id: 'rat-1', username: 'Rat' } };
			const sel = makeInteraction('SelectPicking', {
				isSelect: true, userId: 'user-1', values: ['rat-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Picking', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Picking is on cooldown and cannot be used'
			);
		});

		test('executes picking: changes role, deducts XP, sets cooldown, emits event', async () => {
			CacheGetUserXP.mockResolvedValue(500);
			CacheGetCooldown.mockResolvedValue(null);

			const target = { id: 'rat-1', user: { id: 'rat-1', username: 'Rat' } };
			const sel = makeInteraction('SelectPicking', {
				isSelect: true, userId: 'user-1', values: ['rat-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Picking', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(changeRole).toHaveBeenCalledWith(target, 'Poop', false);
			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -100, client);
			expect(CacheSetCooldown).toHaveBeenCalledWith('picking', 'user-1', 1200000);
			expect(eventEmitter.emit).toHaveBeenCalledWith('PickingComplete', 'rat-1', 'user-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('chewed on a pest')
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
		test('returns early when interaction is neither button nor select menu', async () => {
			const interaction = {
				customId: 'Depravity',
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

	describe('ServerStatusChange event listener', () => {
		test('is registered on eventEmitter', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('ServerStatusChange', expect.any(Function));
		});
	});
});
