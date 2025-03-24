const {
	scheduledXpBoost,
	stopBoosting,
	checkAndApplyMissedXPBoost,
	buildSelectMenu,
	sendInteractionReply,
	grantAstralRealmAccess,
	revokeAstralRealmAccess,
	_test: { wait, keepBoosting },
} = require('../../functions/botActions');
const { DBGetLastXPBoostTime, DBBoostXPForAllUsers } = require('../../apis/firebase/querys');
const { StringSelectMenuBuilder } = require('discord.js');

jest.mock('../../apis/firebase/querys');
jest.mock('discord.js');

describe('botActions.js', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('wait function resolves after specified time', async () => {
		const start = Date.now();
		await wait(100);
		const end = Date.now();
		expect(end - start).toBeGreaterThanOrEqual(100);
	});

	test('stopBoosting sets keepBoosting to false', () => {
		stopBoosting();
		expect(keepBoosting).toBe(false);
	});

	test('scheduledXpBoost waits for timeUntilNextBoost and calls DBBoostXPForAllUsers', async () => {
		keepBoosting = true;
		const mockClient = {};
		DBBoostXPForAllUsers.mockResolvedValue();
		const timeUntilNextBoost = 100;

		const promise = scheduledXpBoost(timeUntilNextBoost, mockClient);
		await new Promise(res => setTimeout(res, timeUntilNextBoost + 10));
		expect(DBBoostXPForAllUsers).toHaveBeenCalled();
		keepBoosting = false;
		await promise;
	});

	test('checkAndApplyMissedXPBoost calculates correct timeUntilNextBoost and calls DBBoostXPForAllUsers', async () => {
		const mockClient = {};
		const now = Date.now();
		DBGetLastXPBoostTime.mockResolvedValue(now - 2 * XpBoostInterval);
		DBBoostXPForAllUsers.mockResolvedValue();

		const timeUntilNextBoost = await checkAndApplyMissedXPBoost(mockClient);
		expect(DBBoostXPForAllUsers).toHaveBeenCalledWith(2, mockClient);
		expect(timeUntilNextBoost).toBe(XpBoostInterval - ((now - 2 * XpBoostInterval) % XpBoostInterval));
	});

	test('buildSelectMenu builds select menu correctly', async () => {
		const mockClient = {
			guilds: {
				fetch: jest.fn().mockResolvedValue({
					members: {
						fetch: jest.fn().mockResolvedValue(),
						cache: {
							filter: jest.fn().mockReturnThis(),
							map: jest.fn().mockReturnValue([{ user: { username: 'user1' }, id: '1' }]),
						},
					},
				}),
			},
		};
		const roleNames = ['role1'];
		const customId = 'customId';
		const chooseText = 'Choose a role';

		const selectMenu = await buildSelectMenu(mockClient, roleNames, customId, chooseText);
		expect(selectMenu).toBeInstanceOf(StringSelectMenuBuilder);
		expect(selectMenu.options).toContainEqual({ label: 'user1', value: '1' });
	});

	test('sendInteractionReply replies or follows up correctly', async () => {
		const mockInteraction = {
			replied: false,
			deferred: false,
			reply: jest.fn().mockResolvedValue(),
			followUp: jest.fn().mockResolvedValue(),
		};
		const msg = 'test message';

		await sendInteractionReply(mockInteraction, msg);
		expect(mockInteraction.reply).toHaveBeenCalledWith({ content: msg, ephemeral: true });

		mockInteraction.replied = true;
		await sendInteractionReply(mockInteraction, msg);
		expect(mockInteraction.followUp).toHaveBeenCalledWith(msg);
	});

	test('grantAstralRealmAccess sets permissions and schedules removal', async () => {
		const mockClient = {
			channels: { fetch: jest.fn().mockResolvedValue({ permissionOverwrites: { create: jest.fn(), delete: jest.fn() } }) },
		};
		const mockMember = { id: '1' };
		const type = 'scholar';

		const result = await grantAstralRealmAccess(mockMember, mockClient, type);
		expect(result).toBe(true);

		await new Promise(res => setTimeout(res, ScholarAstralRealmAccessDuration + 10));
		expect(mockClient.channels.fetch().permissionOverwrites.delete).toHaveBeenCalledWith(mockMember);
	});

	test('revokeAstralRealmAccess deletes permissions correctly', async () => {
		const mockClient = {
			channels: { fetch: jest.fn().mockResolvedValue({ permissionOverwrites: { delete: jest.fn() } }) },
		};
		const mockMember = { id: '1' };

		const result = await revokeAstralRealmAccess(mockMember, mockClient);
		expect(result).toBe(true);
		expect(mockClient.channels.fetch().permissionOverwrites.delete).toHaveBeenCalledWith(mockMember);
	});
});
