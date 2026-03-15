jest.mock('discord.js', () => ({
	StringSelectMenuBuilder: jest.fn().mockImplementation(() => ({
		setCustomId: jest.fn().mockReturnThis(),
		setPlaceholder: jest.fn().mockReturnThis(),
		setDisabled: jest.fn().mockReturnThis(),
		addOptions: jest.fn().mockReturnThis(),
	})),
	MessageFlags: { Ephemeral: 64 },
}));

jest.mock('../../game_config.json', () => ({
	XpBoostInterval: 1000,
	ScholarAstralRealmAccessDuration: 500,
	EmperorAstralRealmAccessDuration: 500,
}));

jest.mock('../../apis/firebase/querys.js', () => ({
	DBGetLastXPBoostTime: jest.fn(),
	DBBoostXPForAllUsers: jest.fn().mockResolvedValue(),
	startupEmperorThreshold: jest.fn().mockResolvedValue(),
	evaluateThresholds: jest.fn().mockResolvedValue(),
}));

jest.mock('../../apis/redis/redisCache.js', () => ({
	CacheGetUsersByRoles: jest.fn().mockResolvedValue([]),
}));

const {
	sendInteractionReply,
	buildSelectMenu,
	messageChannel,
	messageAllHumanChannels,
	checkAndApplyMissedXPBoost,
	grantAstralRealmAccess,
	revokeAstralRealmAccess,
} = require('../../functions/botActions');

const { DBGetLastXPBoostTime, DBBoostXPForAllUsers } = require('../../apis/firebase/querys.js');
const { CacheGetUsersByRoles } = require('../../apis/redis/redisCache.js');

beforeEach(() => {
	jest.clearAllMocks();
	process.env.GUILDID = 'guild-test';
	process.env.CHANNELID_FARMS = 'ch-farms';
	process.env.CHANNELID_LIBRARY = 'ch-library';
	process.env.CHANNELID_MARKET = 'ch-market';
	process.env.CHANNELID_BARRACKS = 'ch-barracks';
	process.env.CHANNELID_GREAT_COUNCIL = 'ch-council';
	process.env.CHANNELID_ROYAL_CASTLE = 'ch-castle';
	process.env.CHANNELID_THRONE_ROOM = 'ch-throne';
	process.env.CHANNELIDASTRALREALM = 'ch-astral';
});

describe('sendInteractionReply', () => {
	test('calls followUp when interaction.replied is true', async () => {
		const interaction = {
			replied: true, deferred: false,
			followUp: jest.fn().mockResolvedValue(),
			reply: jest.fn().mockResolvedValue(),
		};
		await sendInteractionReply(interaction, 'msg');
		expect(interaction.followUp).toHaveBeenCalledWith('msg');
		expect(interaction.reply).not.toHaveBeenCalled();
	});

	test('calls followUp when interaction.deferred is true', async () => {
		const interaction = {
			replied: false, deferred: true,
			followUp: jest.fn().mockResolvedValue(),
			reply: jest.fn().mockResolvedValue(),
		};
		await sendInteractionReply(interaction, 'msg');
		expect(interaction.followUp).toHaveBeenCalledWith('msg');
	});

	test('calls reply with Ephemeral flag when not replied or deferred', async () => {
		const interaction = {
			replied: false, deferred: false,
			followUp: jest.fn().mockResolvedValue(),
			reply: jest.fn().mockResolvedValue(),
		};
		await sendInteractionReply(interaction, 'hello');
		expect(interaction.reply).toHaveBeenCalledWith({ content: 'hello', flags: 64 });
	});

	test('does not throw when reply throws', async () => {
		const interaction = {
			replied: false, deferred: false,
			reply: jest.fn().mockRejectedValue(new Error('Missing Access')),
		};
		await expect(sendInteractionReply(interaction, 'msg')).resolves.not.toThrow();
	});
});

describe('buildSelectMenu', () => {
	const mockClient = { guilds: { fetch: jest.fn().mockResolvedValue({}) } };

	test('disables menu and adds placeholder when no users', async () => {
		CacheGetUsersByRoles.mockResolvedValue([]);
		const menu = await buildSelectMenu(mockClient, ['peasant'], 'myMenu', 'Choose');
		expect(menu.setDisabled).toHaveBeenCalledWith(true);
		expect(menu.addOptions).toHaveBeenCalledWith([
			{ label: 'No peasant', value: 'no_data', disabled: true },
		]);
	});

	test('enables menu and adds user options when users exist', async () => {
		CacheGetUsersByRoles.mockResolvedValue([
			{ id: 'u1', username: 'Alice' },
			{ id: 'u2', username: 'Bob' },
		]);
		const menu = await buildSelectMenu(mockClient, ['knight'], 'myMenu', 'Pick a knight');
		expect(menu.setDisabled).toHaveBeenCalledWith(false);
		expect(menu.addOptions).toHaveBeenCalledWith([
			{ label: 'Alice', value: 'u1' },
			{ label: 'Bob', value: 'u2' },
		]);
	});

	test('uses default placeholder from role names when no chooseText', async () => {
		CacheGetUsersByRoles.mockResolvedValue([]);
		const menu = await buildSelectMenu(mockClient, ['lord', 'king'], 'myMenu');
		expect(menu.setPlaceholder).toHaveBeenCalledWith('Choose a lord | king');
	});

	test('uses custom chooseText when provided', async () => {
		CacheGetUsersByRoles.mockResolvedValue([]);
		const menu = await buildSelectMenu(mockClient, ['lord'], 'myMenu', 'Pick a lord');
		expect(menu.setPlaceholder).toHaveBeenCalledWith('Pick a lord');
	});

	test('sets correct customId', async () => {
		CacheGetUsersByRoles.mockResolvedValue([]);
		const menu = await buildSelectMenu(mockClient, ['noble'], 'targetMenu');
		expect(menu.setCustomId).toHaveBeenCalledWith('targetMenu');
	});
});

describe('messageChannel', () => {
	test('fetches channel by id and sends message', async () => {
		const mockSend = jest.fn().mockResolvedValue({});
		const client = { channels: { fetch: jest.fn().mockResolvedValue({ send: mockSend }) } };
		await messageChannel(client, 'ch-123', 'Hello!');
		expect(client.channels.fetch).toHaveBeenCalledWith('ch-123');
		expect(mockSend).toHaveBeenCalledWith('Hello!');
	});

	test('does not throw when fetch fails (Missing Access)', async () => {
		const client = { channels: { fetch: jest.fn().mockRejectedValue(new Error('Missing Access')) } };
		await expect(messageChannel(client, 'bad-ch', 'msg')).resolves.not.toThrow();
	});
});

describe('messageAllHumanChannels', () => {
	function makeClient() {
		const mockSend = jest.fn().mockResolvedValue({});
		return {
			client: { channels: { fetch: jest.fn().mockResolvedValue({ send: mockSend }) } },
			mockSend,
		};
	}

	test('messages all 7 channels when onlyLowerRoles is false', async () => {
		const { client, mockSend } = makeClient();
		await messageAllHumanChannels(client, 'msg', false);
		expect(mockSend).toHaveBeenCalledTimes(7);
	});

	test('messages only 4 lower channels when onlyLowerRoles is true', async () => {
		const { client, mockSend } = makeClient();
		await messageAllHumanChannels(client, 'msg', true);
		expect(mockSend).toHaveBeenCalledTimes(4);
	});
});

describe('checkAndApplyMissedXPBoost', () => {
	const client = {};

	test('returns undefined when no last boost time stored', async () => {
		DBGetLastXPBoostTime.mockResolvedValue(null);
		const result = await checkAndApplyMissedXPBoost(client);
		expect(result).toBeUndefined();
		expect(DBBoostXPForAllUsers).not.toHaveBeenCalled();
	});

	test('applies correct number of missed boosts', async () => {
		const now = Date.now();
		DBGetLastXPBoostTime.mockResolvedValue(now - 3500); // 3.5 intervals of 1000ms
		const result = await checkAndApplyMissedXPBoost(client);
		expect(DBBoostXPForAllUsers).toHaveBeenCalledWith(3, client);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThan(0);
		expect(result).toBeLessThanOrEqual(1000);
	});

	test('does not apply boosts when within current interval', async () => {
		const now = Date.now();
		DBGetLastXPBoostTime.mockResolvedValue(now - 400); // less than one interval
		const result = await checkAndApplyMissedXPBoost(client);
		expect(DBBoostXPForAllUsers).not.toHaveBeenCalled();
		expect(result).toBeGreaterThan(0);
		expect(result).toBeLessThanOrEqual(1000);
	});

	test('applies exactly 1 boost for exactly 1 missed interval', async () => {
		const now = Date.now();
		DBGetLastXPBoostTime.mockResolvedValue(now - 1500); // 1.5 intervals
		await checkAndApplyMissedXPBoost(client);
		expect(DBBoostXPForAllUsers).toHaveBeenCalledWith(1, client);
	});
});

describe('grantAstralRealmAccess', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	function makeAstralClient() {
		const mockCreate = jest.fn().mockResolvedValue();
		const mockDelete = jest.fn().mockResolvedValue();
		return {
			client: {
				channels: {
					fetch: jest.fn().mockResolvedValue({
						permissionOverwrites: { create: mockCreate, delete: mockDelete },
					}),
				},
			},
			mockCreate,
			mockDelete,
		};
	}

	test('grants read-only access for scholar type', async () => {
		const { client, mockCreate } = makeAstralClient();
		const result = await grantAstralRealmAccess({ id: 'm1' }, client, 'scholar');
		expect(result).toBe(true);
		expect(mockCreate).toHaveBeenCalledWith(
			{ id: 'm1' },
			{ ViewChannel: true, SendMessages: false }
		);
	});

	test('grants write access for emperor type', async () => {
		const { client, mockCreate } = makeAstralClient();
		await grantAstralRealmAccess({ id: 'm1' }, client, 'emperor');
		expect(mockCreate).toHaveBeenCalledWith(
			{ id: 'm1' },
			{ ViewChannel: true, SendMessages: true }
		);
	});

	test('returns false when channel fetch fails', async () => {
		const client = { channels: { fetch: jest.fn().mockRejectedValue(new Error('no access')) } };
		const result = await grantAstralRealmAccess({}, client, 'scholar');
		expect(result).toBe(false);
	});
});

describe('revokeAstralRealmAccess', () => {
	test('deletes permission overwrite and returns true', async () => {
		const mockDelete = jest.fn().mockResolvedValue();
		const client = {
			channels: {
				fetch: jest.fn().mockResolvedValue({ permissionOverwrites: { delete: mockDelete } }),
			},
		};
		const result = await revokeAstralRealmAccess({ id: 'm1' }, client);
		expect(result).toBe(true);
		expect(mockDelete).toHaveBeenCalledWith({ id: 'm1' });
	});

	test('returns false when revoke fails', async () => {
		const client = { channels: { fetch: jest.fn().mockRejectedValue(new Error('error')) } };
		const result = await revokeAstralRealmAccess({}, client);
		expect(result).toBe(false);
	});
});
