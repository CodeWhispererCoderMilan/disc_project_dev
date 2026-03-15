jest.mock('../../apis/redis/redisCache', () => ({
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
	CacheGetCooldown: jest.fn().mockResolvedValue(null),
	CacheSetCooldown: jest.fn().mockResolvedValue(),
	CacheGetUserXP: jest.fn().mockResolvedValue(1000),
	CacheGetKnightWrits: jest.fn().mockResolvedValue([]),
	CacheCheckActiveWrit: jest.fn().mockResolvedValue(null),
	CacheUpdateWritStatus: jest.fn().mockResolvedValue(),
	CacheCheckAndUpdateUserWrits: jest.fn().mockResolvedValue(),
}));

jest.mock('../../apis/firebase/querys.js', () => ({
	DBUpdateXP: jest.fn().mockResolvedValue(),
	changeRole: jest.fn().mockResolvedValue(),
	isThresholdOpen: jest.fn().mockReturnValue(false),
	openThreshold: jest.fn().mockResolvedValue(),
	closeThreshold: jest.fn().mockResolvedValue(),
}));

jest.mock('../../game_config.json', () => ({
	CutDownCost: 100,
	CutDownCooldown: 1200000,
	RoleChangeMessageDisplayTime: 60000,
	MinimumKnightSize: 3,
	TextKnightMessageContent: 'knight content',
	TextCutDownSelectMenu: 'Choose who to cut down',
	TextRevolutionTargetSelectMenu: 'Choose revolution target',
	TextCoupTargetSelectMenu: 'Choose coup target',
	TextEmperorCandidateSelectMenu: 'Choose emperor candidate',
	ButtonLabelCoup: 'Coup',
	ButtonLabelRevolution: 'Revolution',
	ButtonLabelCutDown: 'Cut Down',
	ButtonLabelVoteEmperor: 'Vote Emperor',
	ButtonLabelWithdrawRevolution: 'Withdraw from Revolution',
	ButtonLabelJoinCoup: 'Join Coup',
	ButtonLabelJoinSiege: 'Join Siege',
	ButtonLabelJoinRevolution: 'Join Revolution',
	ButtonLabelShowWrits: 'Read Thine Writs',
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
	getDisableCoup: jest.fn().mockReturnValue(false),
	isServerDown: jest.fn().mockReturnValue(false),
	getRevolutionarySize: jest.fn().mockReturnValue(0),
	getPeopleSize: jest.fn().mockReturnValue(0),
	addRevolutionParticipant: jest.fn(),
	removeRevolutionParticipant: jest.fn(),
	getStruggleMethod: jest.fn().mockReturnValue('Revolution'),
	getRoleSize: jest.fn().mockReturnValue(2),
	getDisableSiege: jest.fn().mockReturnValue(false),
	isSiegeActive: jest.fn().mockReturnValue(false),
	isSiegeParticipant: jest.fn().mockReturnValue(false),
	getSiegeParticipantsSize: jest.fn().mockReturnValue(0),
	getSiegeInitiatorId: jest.fn().mockReturnValue(null),
	getSiegeTargetId: jest.fn().mockReturnValue(null),
	getSiegeInitiator: jest.fn().mockReturnValue('KingX'),
	getSiegeTarget: jest.fn().mockReturnValue('KingY'),
	addSiegeParticipant: jest.fn(),
	removeSiegeParticipant: jest.fn(),
	getHigherRoleSize: jest.fn().mockReturnValue(1),
	getKnightParticipants: jest.fn().mockReturnValue(new Set()),
	getCivilParticipants: jest.fn().mockReturnValue(new Set()),
	getEmperorElectionRoleSize: jest.fn().mockReturnValue(5),
	getSelectedRevolutionTargets: jest.fn().mockReturnValue(new Set()),
	resetRevolution: jest.fn(),
	setRevolutionActive: jest.fn(),
	getDisableAssassination: jest.fn().mockReturnValue(false),
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
			getTextInputValue: jest.fn().mockImplementation((key) => opts.fields?.[key] ?? ''),
		},
		guild: { members: { fetch: jest.fn().mockResolvedValue(fetchedMember) } },
		client: { users: { fetch: jest.fn().mockResolvedValue({ id: 'u1', username: 'User' }) } },
		isStringSelectMenu: () => opts.isSelect === true,
		isButton: () => opts.isSelect !== true && opts.isModal !== true,
		isModalSubmit: () => opts.isModal === true,
	};
}

// Helper: make a guild member with selective roles set
beforeAll(() => {
	process.env.ROLEID_KNIGHT   = 'role-knight';
	process.env.ROLEID_NOBLE    = 'role-noble';
	process.env.ROLEID_LORD     = 'role-lord';
	process.env.ROLEID_KING     = 'role-king';
	process.env.ROLEID_EMPEROR  = 'role-emperor';
	process.env.ROLEID_PEASANT  = 'role-peasant';
	process.env.ROLEID_SCHOLAR  = 'role-scholar';
	process.env.ROLEID_MERCHANT = 'role-merchant';
	process.env.ROLEID_SUBHUMAN = 'role-subhuman';
	process.env.ROLEID_MAGGOT   = 'role-maggot';
	process.env.ROLEID_RAT      = 'role-rat';
	process.env.ROLEID_COCKROACH = 'role-cockroach';
});

function makeMemberWithRoles(id, roleFlags = {}) {
	return {
		id,
		user: { username: 'TestMember', id },
		roles: {
			cache: {
				has: jest.fn((roleId) => {
					if (roleId === process.env.ROLEID_KNIGHT)   return !!roleFlags.knight;
					if (roleId === process.env.ROLEID_NOBLE)    return !!roleFlags.noble;
					if (roleId === process.env.ROLEID_LORD)     return !!roleFlags.lord;
					if (roleId === process.env.ROLEID_KING)     return !!roleFlags.king;
					if (roleId === process.env.ROLEID_EMPEROR)  return !!roleFlags.emperor;
					if (roleId === process.env.ROLEID_PEASANT)  return !!roleFlags.peasant;
					if (roleId === process.env.ROLEID_SCHOLAR)  return !!roleFlags.scholar;
					if (roleId === process.env.ROLEID_MERCHANT) return !!roleFlags.merchant;
					return false;
				}),
			},
		},
	};
}

describe('knight_commands', () => {
	let setupKnightBotEvents;
	let CacheGetUserXP;
	let CacheGetCooldown;
	let CacheSetCooldown;
	let CacheGetKnightWrits;
	let CacheCheckActiveWrit;
	let CacheGetUsersByRoles;
	let DBUpdateXP;
	let changeRole;
	let sendInteractionReply;
	let messageChannel;
	let eventEmitter;
	let gameState;
	let handlers;
	let client;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupKnightBotEvents } = require('../../role_commands/knight_commands'));
		({
			CacheGetUserXP,
			CacheGetCooldown,
			CacheSetCooldown,
			CacheGetKnightWrits,
			CacheCheckActiveWrit,
			CacheGetUsersByRoles,
		} = require('../../apis/redis/redisCache'));
		({ DBUpdateXP, changeRole } = require('../../apis/firebase/querys.js'));
		({ sendInteractionReply, messageChannel } = require('../../functions/botActions.js'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));
		gameState = require('../../game_state.js');

		const mock = makeMockClient();
		client = mock.client;
		handlers = mock.handlers;
		setupKnightBotEvents(client, 'msg-id');
	});

	// ─── Event listener registration ─────────────────────────────────────────

	describe('event listener registration', () => {
		test('registers interactionCreate handler', () => {
			expect(client.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
		});

		test('registers guildMemberUpdate handler', () => {
			expect(client.on).toHaveBeenCalledWith('guildMemberUpdate', expect.any(Function));
		});

		test('registers guildMemberRemove handler', () => {
			expect(client.on).toHaveBeenCalledWith('guildMemberRemove', expect.any(Function));
		});
	});

	// ─── Interaction filter ────────────────────────────────────────────────

	describe('interaction filter', () => {
		test('returns early for non-button, non-select interactions', async () => {
			const interaction = {
				customId: 'CutDown',
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

	// ─── Select menus (defer only) ─────────────────────────────────────────

	describe('SelectCutDown', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectCutDown', { isSelect: true, values: ['target-99'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('target-99');
		});
	});

	describe('SelectRevolutionTarget', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectRevolutionTarget', { isSelect: true, values: ['rev-target'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('rev-target');
		});
	});

	describe('SelectCoupTarget', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectCoupTarget', { isSelect: true, values: ['coup-target'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('coup-target');
		});
	});

	describe('SelectEmperorCandidate', () => {
		test('defers update and fetches the selected member', async () => {
			const interaction = makeInteraction('SelectEmperorCandidate', { isSelect: true, values: ['emperor-candidate'] });
			await handlers.interactionCreate(interaction);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(interaction.guild.members.fetch).toHaveBeenCalledWith('emperor-candidate');
		});
	});

	// ─── CutDown ──────────────────────────────────────────────────────────

	describe('CutDown', () => {
		test('replies with no scoundrel selected when no target is stored', async () => {
			const interaction = makeInteraction('CutDown', { userId: 'user-no-target' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No scoundrel selected')
			);
		});

		test('replies with writ required when target has knight role and no valid writ exists', async () => {
			const knightMember = makeMemberWithRoles('knight-target', { knight: true });
			// Store the target via SelectCutDown
			const selInteraction = makeInteraction('SelectCutDown', {
				isSelect: true,
				userId: 'user-1',
				values: ['knight-target'],
				fetchedMember: knightMember,
			});
			await handlers.interactionCreate(selInteraction);

			CacheCheckActiveWrit.mockResolvedValue(null);
			const cutdownInteraction = makeInteraction('CutDown', { userId: 'user-1' });
			await handlers.interactionCreate(cutdownInteraction);

			expect(sendInteractionReply).toHaveBeenCalledWith(
				cutdownInteraction,
				'Target only available with appropriate writ'
			);
		});

		test('replies with writ required when target has noble role and no valid writ exists', async () => {
			const nobleMember = makeMemberWithRoles('noble-target', { noble: true });
			const selInteraction = makeInteraction('SelectCutDown', {
				isSelect: true,
				userId: 'user-1',
				values: ['noble-target'],
				fetchedMember: nobleMember,
			});
			await handlers.interactionCreate(selInteraction);

			CacheCheckActiveWrit.mockResolvedValue(null);
			const cutdownInteraction = makeInteraction('CutDown', { userId: 'user-1' });
			await handlers.interactionCreate(cutdownInteraction);

			expect(sendInteractionReply).toHaveBeenCalledWith(
				cutdownInteraction,
				'Target only available with appropriate writ'
			);
		});

		test('proceeds with deferReply when writ4 is valid for a knight target', async () => {
			const knightMember = makeMemberWithRoles('knight-target', { knight: true });
			const selInteraction = makeInteraction('SelectCutDown', {
				isSelect: true,
				userId: 'user-1',
				values: ['knight-target'],
				fetchedMember: knightMember,
			});
			await handlers.interactionCreate(selInteraction);

			// writ4 valid for any protected role
			CacheCheckActiveWrit.mockImplementation((_uid, _tid, type) =>
				Promise.resolve(type === 4 ? true : null)
			);
			CacheGetKnightWrits.mockResolvedValue([]);
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUserXP.mockResolvedValue(500);

			const cutdownInteraction = makeInteraction('CutDown', { userId: 'user-1' });
			cutdownInteraction.guild.members.fetch.mockResolvedValue(knightMember);
			await handlers.interactionCreate(cutdownInteraction);

			expect(cutdownInteraction.deferReply).toHaveBeenCalled();
		});

		test('replies with not enough drops when no writ and XP is below CutDownCost', async () => {
			const peasantMember = makeMemberWithRoles('peasant-target', { peasant: true });
			const selInteraction = makeInteraction('SelectCutDown', {
				isSelect: true,
				userId: 'user-1',
				values: ['peasant-target'],
				fetchedMember: peasantMember,
			});
			await handlers.interactionCreate(selInteraction);

			CacheCheckActiveWrit.mockResolvedValue(null);
			CacheGetUserXP.mockResolvedValue(50); // below cost of 100

			const cutdownInteraction = makeInteraction('CutDown', { userId: 'user-1' });
			await handlers.interactionCreate(cutdownInteraction);

			expect(sendInteractionReply).toHaveBeenCalledWith(
				cutdownInteraction,
				expect.stringContaining('Not enough drops')
			);
		});

		test('deducts XP and confirms cut down when no writ and XP is sufficient', async () => {
			const peasantMember = makeMemberWithRoles('peasant-target', { peasant: true });
			const selInteraction = makeInteraction('SelectCutDown', {
				isSelect: true,
				userId: 'user-1',
				values: ['peasant-target'],
				fetchedMember: peasantMember,
			});
			await handlers.interactionCreate(selInteraction);

			CacheCheckActiveWrit.mockResolvedValue(null);
			CacheGetUserXP.mockResolvedValue(500);

			const cutdownInteraction = makeInteraction('CutDown', { userId: 'user-1' });
			cutdownInteraction.guild.members.fetch.mockResolvedValue(peasantMember);
			await handlers.interactionCreate(cutdownInteraction);

			expect(DBUpdateXP).toHaveBeenCalledWith('user-1', -100, client);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				cutdownInteraction,
				expect.stringContaining('Cut Down successful with no writ')
			);
		});

		test('calls changeRole to Poop when cut down executes without writ', async () => {
			const peasantMember = makeMemberWithRoles('peasant-target', { peasant: true });
			const selInteraction = makeInteraction('SelectCutDown', {
				isSelect: true,
				userId: 'user-1',
				values: ['peasant-target'],
				fetchedMember: peasantMember,
			});
			await handlers.interactionCreate(selInteraction);

			CacheCheckActiveWrit.mockResolvedValue(null);
			CacheGetUserXP.mockResolvedValue(500);

			const cutdownInteraction = makeInteraction('CutDown', { userId: 'user-1' });
			cutdownInteraction.guild.members.fetch.mockResolvedValue(peasantMember);
			await handlers.interactionCreate(cutdownInteraction);

			expect(changeRole).toHaveBeenCalledWith(peasantMember, 'Poop', false);
		});

		test('uses active writ path when non-protected target has an active writ', async () => {
			const merchantMember = makeMemberWithRoles('merchant-target', { merchant: true });
			const selInteraction = makeInteraction('SelectCutDown', {
				isSelect: true,
				userId: 'user-1',
				values: ['merchant-target'],
				fetchedMember: merchantMember,
			});
			await handlers.interactionCreate(selInteraction);

			// No writ type argument means active-writ check (no type param)
			CacheCheckActiveWrit.mockImplementation((_uid, _tid, type) =>
				Promise.resolve(type === undefined ? true : null)
			);
			CacheGetKnightWrits.mockResolvedValue([]);
			CacheGetCooldown.mockResolvedValue(null);
			CacheGetUserXP.mockResolvedValue(500);

			const cutdownInteraction = makeInteraction('CutDown', { userId: 'user-1' });
			cutdownInteraction.guild.members.fetch.mockResolvedValue(merchantMember);
			await handlers.interactionCreate(cutdownInteraction);

			expect(cutdownInteraction.deferReply).toHaveBeenCalled();
		});
	});

	// ─── ShowWrits ────────────────────────────────────────────────────────

	describe('ShowWrits', () => {
		test('replies with no active writs message when knight has no writs', async () => {
			CacheGetKnightWrits.mockResolvedValue([]);
			const interaction = makeInteraction('ShowWrits', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'You have no active writs.');
		});

		test('replies with writ list containing target and status when writs exist', async () => {
			CacheGetKnightWrits.mockResolvedValue([
				{
					writType: 2,
					targetId: 'target-5',
					writStatus: 0,
					writMessage: 'execute target',
					writAmount: 400,
				},
			]);
			const interaction = makeInteraction('ShowWrits', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Your active writs')
			);
		});

		test('replies with multiple writs formatted in list', async () => {
			CacheGetKnightWrits.mockResolvedValue([
				{ writType: 1, targetId: 'target-a', writStatus: 0, writMessage: 'msg-a', writAmount: 200 },
				{ writType: 3, targetId: 'target-b', writStatus: 1, writMessage: 'msg-b', writAmount: 800 },
			]);
			const interaction = makeInteraction('ShowWrits', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			const call = sendInteractionReply.mock.calls[0][1];
			expect(call).toContain('target-a');
			expect(call).toContain('target-b');
		});
	});

	// ─── JoinSiege ────────────────────────────────────────────────────────

	describe('JoinSiege', () => {
		test('replies with no active siege when siege is not active', async () => {
			gameState.isSiegeActive.mockReturnValue(false);
			const interaction = makeInteraction('JoinSiege', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('There is no active siege')
			);
		});

		test('replies with already joined when user is already a siege participant', async () => {
			gameState.isSiegeActive.mockReturnValue(true);
			gameState.isSiegeParticipant.mockReturnValue(true);
			const interaction = makeInteraction('JoinSiege', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				"You've already joined this siege."
			);
		});

		test('emits KnightParticipatedOnSiege and sends confirmation on success', async () => {
			gameState.isSiegeActive.mockReturnValue(true);
			gameState.isSiegeParticipant.mockReturnValue(false);
			gameState.getSiegeInitiatorId.mockReturnValue('king-1');
			gameState.getSiegeTargetId.mockReturnValue('king-2');

			const interaction = makeInteraction('JoinSiege', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith('KnightParticipatedOnSiege', 'user-1');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('joind the siege')
			);
		});

		test('messages barracks and royal castle channels on success', async () => {
			gameState.isSiegeActive.mockReturnValue(true);
			gameState.isSiegeParticipant.mockReturnValue(false);
			gameState.getSiegeInitiatorId.mockReturnValue('king-1');
			gameState.getSiegeTargetId.mockReturnValue('king-2');

			const interaction = makeInteraction('JoinSiege', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(messageChannel).toHaveBeenCalledTimes(2);
		});
	});

	// ─── Revolution ───────────────────────────────────────────────────────

	describe('Revolution', () => {
		test('replies with revolution already active', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'Revolution is already active');
		});

		test('replies with no member selected when no revolution target was chosen', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('Revolution', { userId: 'user-no-target' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'No member selected');
		});

		test('replies with cooldown message when revolution is on cooldown', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(Date.now());

			const targetMember = makeMemberWithRoles('king-target', { king: true });
			const selInteraction = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['king-target'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'Revolution is on cooldown');
		});

		test('replies with cannot target yourself', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(null);

			const selfMember = makeMemberWithRoles('user-1', {});
			const selInteraction = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['user-1'],
				fetchedMember: selfMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'You cannot target yourself.');
		});

		test('emits StartRevolution with Knight role and confirms on success', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(null);

			const targetMember = makeMemberWithRoles('king-target', { king: true });
			const selInteraction = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['king-target'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('Revolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith('StartRevolution', 'user-1', 'king-target', 'Knight');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Revolution started')
			);
		});
	});

	// ─── Coup ─────────────────────────────────────────────────────────────

	describe('Coup', () => {
		test('replies with coup already active', async () => {
			gameState.isCoupActive.mockReturnValue(true);
			const interaction = makeInteraction('Coup', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'Coup is already active');
		});

		test('replies with no member selected when no coup target was chosen', async () => {
			gameState.isCoupActive.mockReturnValue(false);
			const interaction = makeInteraction('Coup', { userId: 'user-no-target' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'No member selected');
		});

		test('replies with cooldown message when coup is on cooldown', async () => {
			gameState.isCoupActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(Date.now());

			const targetMember = makeMemberWithRoles('king-target', { king: true });
			const selInteraction = makeInteraction('SelectCoupTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['king-target'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('Coup', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'Coup is on cooldown');
		});

		test('emits StartCoup and confirms on success', async () => {
			gameState.isCoupActive.mockReturnValue(false);
			CacheGetCooldown.mockResolvedValue(null);

			const targetMember = makeMemberWithRoles('king-target', { king: true });
			const selInteraction = makeInteraction('SelectCoupTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['king-target'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('Coup', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith('StartCoup', 'user-1', 'king-target');
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('Coup started')
			);
		});
	});

	// ─── JoinRevolution ───────────────────────────────────────────────────

	describe('JoinRevolution', () => {
		test('replies with no revolution ongoing when revolution is not active', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No revolution ongoing')
			);
		});

		test('replies with no member selected when no target chosen', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			const interaction = makeInteraction('JoinRevolution', { userId: 'user-no-target' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'No member selected');
		});

		test('replies with already joined when user is already a revolution participant', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);

			const targetMember = makeMemberWithRoles('king-target', { king: true });
			const selInteraction = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['king-target'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				"You've already joined revolution."
			);
		});

		test('emits AddRevolutionParticipant with Knight and confirms on success', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);

			const targetMember = makeMemberWithRoles('king-target', { king: true });
			const selInteraction = makeInteraction('SelectRevolutionTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['king-target'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('JoinRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				'AddRevolutionParticipant',
				'Knight',
				'user-1',
				'king-target'
			);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('You have joined the revolution')
			);
		});
	});

	// ─── JoinCoup ─────────────────────────────────────────────────────────

	describe('JoinCoup', () => {
		test('replies with no coup ongoing when coup is not active', async () => {
			gameState.isCoupActive.mockReturnValue(false);
			const interaction = makeInteraction('JoinCoup', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No coup ongoing')
			);
		});

		test('replies with no member selected when no coup target chosen', async () => {
			gameState.isCoupActive.mockReturnValue(true);
			const interaction = makeInteraction('JoinCoup', { userId: 'user-no-target' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'No member selected');
		});

		test('replies with already joined when user is an existing coup participant', async () => {
			gameState.isCoupActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);

			const targetMember = makeMemberWithRoles('coup-target', { king: true });
			const selInteraction = makeInteraction('SelectCoupTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['coup-target'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('JoinCoup', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, "You've already joined coup.");
		});

		test('emits AddRevolutionParticipant with Knight and confirms on success', async () => {
			gameState.isCoupActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);

			const targetMember = makeMemberWithRoles('coup-target', { king: true });
			const selInteraction = makeInteraction('SelectCoupTarget', {
				isSelect: true,
				userId: 'user-1',
				values: ['coup-target'],
				fetchedMember: targetMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('JoinCoup', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				'AddRevolutionParticipant',
				'Knight',
				'user-1',
				'coup-target'
			);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('You have joined the coup')
			);
		});
	});

	// ─── WithdrawRevolution ───────────────────────────────────────────────

	describe('WithdrawRevolution', () => {
		test('replies with no revolution ongoing when revolution is not active', async () => {
			gameState.isRevolutionActive.mockReturnValue(false);
			const interaction = makeInteraction('WithdrawRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				expect.stringContaining('No revolution ongoing')
			);
		});

		test('replies with not joined when user has not joined the revolution', async () => {
			gameState.isRevolutionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);

			const interaction = makeInteraction('WithdrawRevolution', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				"You've not joined revolution."
			);
		});

		test('emits RemoveRevolutionParticipant and confirms on success', async () => {
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

	// ─── VoteEmperor ──────────────────────────────────────────────────────

	describe('VoteEmperor', () => {
		test('replies with no active election when election is not running', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(false);
			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'There is no active election to vote.'
			);
		});

		test('replies with no member selected when no candidate was chosen', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			const interaction = makeInteraction('VoteEmperor', { userId: 'user-no-candidate' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(interaction, 'No member selected');
		});

		test('replies with already joined when user is already a participant', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(true);

			const candidateMember = makeMemberWithRoles('candidate-1', {});
			const selInteraction = makeInteraction('SelectEmperorCandidate', {
				isSelect: true,
				userId: 'user-1',
				values: ['candidate-1'],
				fetchedMember: candidateMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				"You've already joined the election."
			);
		});

		test('emits AddRevolutionParticipant with Knight and confirms on success', async () => {
			gameState.isEmperorElectionActive.mockReturnValue(true);
			gameState.isRevolutionParticipant.mockReturnValue(false);

			const candidateMember = makeMemberWithRoles('candidate-1', {});
			const selInteraction = makeInteraction('SelectEmperorCandidate', {
				isSelect: true,
				userId: 'user-1',
				values: ['candidate-1'],
				fetchedMember: candidateMember,
			});
			await handlers.interactionCreate(selInteraction);

			const interaction = makeInteraction('VoteEmperor', { userId: 'user-1' });
			await handlers.interactionCreate(interaction);

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				'AddRevolutionParticipant',
				'Knight',
				'user-1',
				'candidate-1'
			);
			expect(sendInteractionReply).toHaveBeenCalledWith(
				interaction,
				'You have joined the election.'
			);
		});
	});

	// ─── guildMemberUpdate handler ─────────────────────────────────────────

	describe('guildMemberUpdate', () => {
		test('does not throw when called with members that have no relevant roles', async () => {
			const oldMember = makeMemberWithRoles('member-1', {});
			const newMember = makeMemberWithRoles('member-1', {});
			await expect(handlers.guildMemberUpdate(oldMember, newMember)).resolves.not.toThrow();
		});

		test('calls CacheGetUsersByRoles when a member loses knight role', async () => {
			const oldMember = makeMemberWithRoles('member-1', { knight: true });
			const newMember = makeMemberWithRoles('member-1', {});
			await handlers.guildMemberUpdate(oldMember, newMember);
			expect(CacheGetUsersByRoles).toHaveBeenCalledWith(['knight']);
		});

		test('calls CacheGetUsersByRoles when a member gains knight role', async () => {
			const oldMember = makeMemberWithRoles('member-1', {});
			const newMember = makeMemberWithRoles('member-1', { knight: true });
			await handlers.guildMemberUpdate(oldMember, newMember);
			expect(CacheGetUsersByRoles).toHaveBeenCalledWith(['knight']);
		});
	});

	// ─── guildMemberRemove handler ────────────────────────────────────────

	describe('guildMemberRemove', () => {
		test('does not throw when a member with no relevant roles leaves', async () => {
			const member = makeMemberWithRoles('member-1', {});
			await expect(handlers.guildMemberRemove(member)).resolves.not.toThrow();
		});
	});
});
