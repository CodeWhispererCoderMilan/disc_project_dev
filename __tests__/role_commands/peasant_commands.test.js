jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
	CacheGetCooldown: jest.fn().mockResolvedValue(null),
	CacheSetCooldown: jest.fn().mockResolvedValue(),
}));

jest.mock('../../apis/firebase/querys.js', () => ({
	changeRole: jest.fn().mockResolvedValue(),
}));

jest.mock('../../game_config.json', () => ({
	MobFlayingTime: 30000,
	MobFlayingSuccessThreshold: 0.5,
	MobFlayingCooldown: 1200000,
	RoleChangeMessageDisplayTime: 5000,
	TextPeasantMessageContent: 'peasant content',
	TextRevolutionTargetSelectMenu: 'Select Revolution Target',
	TextEmperorCandidateSelectMenu: 'Select Emperor Candidate',
	ButtonLabelRevolution: 'Revolution',
	ButtonLabelJoinRevolution: 'Join Revolution',
	ButtonLabelWithdrawRevolution: 'Withdraw Revolution',
	ButtonLabelVoteEmperor: 'Vote Emperor',
	ButtonLabelMobFlaying: 'Mob Flaying',
	ButtonLabelJoinMobFlaying: 'Join Mob Flaying',
	TextMobFlayingSelectMenu: 'Select Mob Flaying Target',
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
	isRevolutionActive: jest.fn().mockReturnValue(false),
	isCoupActive: jest.fn().mockReturnValue(false),
	isRevolutionSecondPhase: jest.fn().mockReturnValue(false),
	isEmperorElectionActive: jest.fn().mockReturnValue(false),
	isReelectionActive: jest.fn().mockReturnValue(false),
	getDisableRevolution: jest.fn().mockReturnValue(false),
	isRevolutionParticipant: jest.fn().mockReturnValue(false),
	getRevolutionarySize: jest.fn().mockReturnValue(0),
	getPeopleSize: jest.fn().mockReturnValue(10),
	getRoleSize: jest.fn().mockReturnValue(5),
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
			components: [mockMenu(), mockMenu()],
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

describe('peasant_commands interactions', () => {
	let setupPeasantBotEvents;
	let CacheGetCooldown;
	let CacheSetCooldown;
	let CacheGetUsersByRoles;
	let changeRole;
	let eventEmitter;
	let sendInteractionReply;
	let gameState;
	let handlers;
	let client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupPeasantBotEvents } = require('../../role_commands/peasant_commands'));
		({ CacheGetCooldown, CacheSetCooldown, CacheGetUsersByRoles } = require('../../apis/redis/redisCache'));
		({ changeRole } = require('../../apis/firebase/querys.js'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));
		({ sendInteractionReply } = require('../../functions/botActions.js'));
		gameState = require('../../game_state.js');

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;
		setupPeasantBotEvents(client, 'msg-id');
	});

	describe('MobFlayingSelectMenu', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('MobFlayingSelectMenu', { isSelect: true, values: ['peas-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('peas-1');
		});
	});

	describe('SelectRevolutionTarget', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectRevolutionTarget', { isSelect: true, values: ['knight-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('knight-1');
		});
	});

	describe('SelectEmperorCandidate', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectEmperorCandidate', { isSelect: true, values: ['noble-1'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('noble-1');
		});
	});

	describe('MobFlaying', () => {
		test('replies with no member selected when no target picked', async () => {
			CacheGetUsersByRoles.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
			const interaction = makeInteraction('MobFlaying', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No member selected'
			);
		});

		test('replies with cooldown message when mob flaying is on cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(1200000);
			CacheGetUsersByRoles.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);

			const target = { id: 'target-1', user: { id: 'target-1', username: 'Target' } };
			const sel = makeInteraction('MobFlayingSelectMenu', {
				isSelect: true, userId: 'user-1', values: ['target-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('MobFlaying', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Mob flaying is on cooldown'
			);
		});

		test('replies with cannot target yourself message for self-target', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUsersByRoles.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);

			const selfMember = { id: 'user-1', user: { id: 'user-1', username: 'Self' } };
			const sel = makeInteraction('MobFlayingSelectMenu', {
				isSelect: true, userId: 'user-1', values: ['user-1'],
				fetchedMember: selfMember,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('MobFlaying', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'You cannot target yourself.'
			);
		});

		test('initiates mob flaying and sets cooldown', async () => {
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUsersByRoles.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }]);

			const target = { id: 'target-1', user: { id: 'target-1', username: 'Target' } };
			const sel = makeInteraction('MobFlayingSelectMenu', {
				isSelect: true, userId: 'user-1', values: ['target-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('MobFlaying', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(CacheSetCooldown).toHaveBeenCalledWith('MobFlaying', 'user-1', 1200000);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Mob flaying initiated')
			);
		});
	});

	describe('JoinMobFlaying', () => {
		test('replies with no active mob flaying when none initiated', async () => {
			const interaction = makeInteraction('JoinMobFlaying', { userId: 'user-2' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'There is no active mob flaying to join.'
			);
		});

		async function startMobFlaying(initiatorId = 'initiator-1') {
			CacheGetCooldown.mockResolvedValue(null);
			// Use 6 peasants so threshold (0.5) requires 3+ participants — allows testing double-join
			CacheGetUsersByRoles.mockResolvedValue([
				{ id: 'initiator-1' }, { id: 'user-2' }, { id: 'user-3' },
				{ id: 'user-4' }, { id: 'user-5' }, { id: 'user-6' },
			]);
			const target = { id: 'target-1', user: { id: 'target-1', username: 'Target' } };
			const sel = makeInteraction('MobFlayingSelectMenu', {
				isSelect: true, userId: initiatorId, values: ['target-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);
			const initiate = makeInteraction('MobFlaying', { userId: initiatorId });
			await handlers.interactionCreate(initiate);
		}

		test('blocks initiator from joining their own mob flaying', async () => {
			await startMobFlaying('initiator-1');
			const interaction = makeInteraction('JoinMobFlaying', { userId: 'initiator-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining("don't need to join")
			);
		});

		test('blocks the mob flaying target from joining', async () => {
			await startMobFlaying('initiator-1');
			const interaction = makeInteraction('JoinMobFlaying', { userId: 'target-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('cannot join')
			);
		});

		test('blocks user from joining twice', async () => {
			await startMobFlaying('initiator-1');
			await handlers.interactionCreate(makeInteraction('JoinMobFlaying', { userId: 'user-2' }));
			const rejoin = makeInteraction('JoinMobFlaying', { userId: 'user-2' });
			await handlers.interactionCreate(rejoin);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				rejoin,
				"You've already joined."
			);
		});

		test('replies with joined message when successfully joining', async () => {
			await startMobFlaying('initiator-1');
			const join = makeInteraction('JoinMobFlaying', { userId: 'user-2' });
			await handlers.interactionCreate(join);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				join,
				expect.stringContaining('joind the mob flaying')
			);
		});
	});

	describe('Revolution', () => {
		test('replies with revolution already active when one is ongoing', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Revolution is already active'
			);
		});

		test('replies with no member selected when no target picked', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('Revolution', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No member selected'
			);
		});

		test('replies with cooldown message when revolution is on cooldown', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(1200000);

			const target = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' } };
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true, userId: 'user-1', values: ['knight-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'Revolution is on cooldown'
			);
		});

		test('replies with cannot target yourself for self-target', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(null);

			const selfMember = { id: 'user-1', user: { id: 'user-1', username: 'Self' } };
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true, userId: 'user-1', values: ['user-1'],
				fetchedMember: selfMember,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'You cannot target yourself.'
			);
		});

		test('emits StartRevolution and replies when started successfully', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(null);

			const target = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' } };
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true, userId: 'user-1', values: ['knight-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith('StartRevolution', 'user-1', 'knight-1', 'Peasant');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Revolution started')
			);
		});
	});

	describe('JoinRevolution', () => {
		test('replies with no revolution ongoing when none active', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No revolution ongoing')
			);
		});

		test('replies with no member selected when no target picked', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			const interaction = makeInteraction('JoinRevolution', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No member selected'
			);
		});

		test('replies with already joined when already a participant', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);

			const target = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' } };
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true, userId: 'user-1', values: ['knight-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				"You've already joined revolution."
			);
		});

		test('emits AddRevolutionParticipant and replies on success', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);

			const target = { id: 'knight-1', user: { id: 'knight-1', username: 'Knight' } };
			const sel = makeInteraction('SelectRevolutionTarget', {
				isSelect: true, userId: 'user-1', values: ['knight-1'],
				fetchedMember: target,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith('AddRevolutionParticipant', 'Peasant', 'user-1', 'knight-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('joined the revolution')
			);
		});
	});

	describe('WithdrawRevolution', () => {
		test('replies with no revolution ongoing when none active', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('WithdrawRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No revolution ongoing')
			);
		});

		test('replies with not joined revolution when not a participant', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);

			const interaction = makeInteraction('WithdrawRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				"You've not joined revolution."
			);
		});

		test('emits RemoveRevolutionParticipant and replies on success', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);

			const interaction = makeInteraction('WithdrawRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith('RemoveRevolutionParticipant', 'user-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('withdrawn the revolution')
			);
		});
	});

	describe('VoteEmperor', () => {
		test('replies with no active election when none ongoing', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(false);
			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('no active election')
			);
		});

		test('replies with no member selected when no candidate picked', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			const interaction = makeInteraction('VoteEmperor', { userId: 'user-99' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'No member selected'
			);
		});

		test('replies with already joined when already a participant', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);

			const candidate = { id: 'noble-1', user: { id: 'noble-1', username: 'Noble' } };
			const sel = makeInteraction('SelectEmperorCandidate', {
				isSelect: true, userId: 'user-1', values: ['noble-1'],
				fetchedMember: candidate,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				"You've already joined the election."
			);
		});

		test('emits AddRevolutionParticipant and replies on successful vote', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);

			const candidate = { id: 'noble-1', user: { id: 'noble-1', username: 'Noble' } };
			const sel = makeInteraction('SelectEmperorCandidate', {
				isSelect: true, userId: 'user-1', values: ['noble-1'],
				fetchedMember: candidate,
			});
			await handlers.interactionCreate(sel);

			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith('AddRevolutionParticipant', 'Peasant', 'user-1', 'noble-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('joined the election')
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
				customId: 'Revolution',
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
		test('registers DisableRevolution listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('DisableRevolution', expect.any(Function));
		});

		test('registers EnableRevolution listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('EnableRevolution', expect.any(Function));
		});

		test('registers RevolutionStarted listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('RevolutionStarted', expect.any(Function));
		});

		test('registers RevolutionFinished listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('RevolutionFinished', expect.any(Function));
		});

		test('registers ServerStatusChange listener', () => {
			expect(eventEmitter.on).toHaveBeenCalledWith('ServerStatusChange', expect.any(Function));
		});
	});
});
