jest.mock('../../functions/eventEmitter.js', () => ({
	eventEmitter: { emit: jest.fn(), on: jest.fn() },
}));

jest.mock('../../game_state.js', () => ({
	isServerDown: jest.fn().mockReturnValue(false),
}));

jest.mock('../../game_config.json', () => ({
	RoleChangeMessageDisplayTime: 5000,
	TextPoopMessageContent: 'poop content',
}));

describe('poop_commands event registration', () => {
	let setupPoopBotEvents;
	let eventEmitter;
	let mockClient;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({ setupPoopBotEvents } = require('../../role_commands/poop_commands'));
		({ eventEmitter } = require('../../functions/eventEmitter.js'));

		mockClient = {
			channels: {
				fetch: jest.fn().mockResolvedValue({
					send: jest.fn().mockResolvedValue({ delete: jest.fn().mockResolvedValue() }),
					messages: { fetch: jest.fn().mockResolvedValue({ edit: jest.fn().mockResolvedValue() }) },
				}),
			},
		};

		setupPoopBotEvents(mockClient, 'msg-id');
	});

	test('registers Death listener on eventEmitter', () => {
		expect(eventEmitter.on).toHaveBeenCalledWith('Death', expect.any(Function));
	});

	test('registers InfanticideComplete listener on eventEmitter', () => {
		expect(eventEmitter.on).toHaveBeenCalledWith('InfanticideComplete', expect.any(Function));
	});

	test('registers notifyFesterTarget listener on eventEmitter', () => {
		expect(eventEmitter.on).toHaveBeenCalledWith('notifyFesterTarget', expect.any(Function));
	});

	test('registers NibbleComplete listener on eventEmitter', () => {
		expect(eventEmitter.on).toHaveBeenCalledWith('NibbleComplete', expect.any(Function));
	});

	test('registers DepravityComplete listener on eventEmitter', () => {
		expect(eventEmitter.on).toHaveBeenCalledWith('DepravityComplete', expect.any(Function));
	});

	test('registers ManhuntComplete listener on eventEmitter', () => {
		expect(eventEmitter.on).toHaveBeenCalledWith('ManhuntComplete', expect.any(Function));
	});

	test('registers PickingComplete listener on eventEmitter', () => {
		expect(eventEmitter.on).toHaveBeenCalledWith('PickingComplete', expect.any(Function));
	});

	test('registers ServerStatusChange listener on eventEmitter', () => {
		expect(eventEmitter.on).toHaveBeenCalledWith('ServerStatusChange', expect.any(Function));
	});

	test('does not register any client.on handlers', () => {
		expect(mockClient).not.toHaveProperty('on');
	});

	describe('Death handler', () => {
		test('sends message to CESSPIT channel when Death fires', async () => {
			const mockChannel = {
				send: jest.fn().mockResolvedValue({ delete: jest.fn() }),
			};
			mockClient.channels.fetch.mockResolvedValue(mockChannel);
			setupPoopBotEvents(mockClient, 'msg-id');

			const deathCalls = eventEmitter.on.mock.calls.filter(c => c[0] === 'Death');
			const handler = deathCalls[deathCalls.length - 1][1];
			await handler('A player died.');

			expect(mockChannel.send).toHaveBeenCalledWith(
				expect.objectContaining({ content: expect.stringContaining('Hit the gutter') })
			);
		});
	});

	describe('InfanticideComplete handler', () => {
		test('sends message mentioning maggotId and cockroachId', async () => {
			const mockChannel = { send: jest.fn().mockResolvedValue({ delete: jest.fn() }) };
			mockClient.channels.fetch.mockResolvedValue(mockChannel);
			setupPoopBotEvents(mockClient, 'msg-id');

			const calls = eventEmitter.on.mock.calls.filter(c => c[0] === 'InfanticideComplete');
			const handler = calls[calls.length - 1][1];
			await handler('maggot-1', 'cockroach-1');

			expect(mockChannel.send).toHaveBeenCalledWith(
				expect.objectContaining({ content: expect.stringContaining('maggot-1') })
			);
		});
	});

	describe('NibbleComplete handler', () => {
		test('sends message mentioning poop and rat IDs', async () => {
			const mockChannel = { send: jest.fn().mockResolvedValue({ delete: jest.fn() }) };
			mockClient.channels.fetch.mockResolvedValue(mockChannel);
			setupPoopBotEvents(mockClient, 'msg-id');

			const calls = eventEmitter.on.mock.calls.filter(c => c[0] === 'NibbleComplete');
			const handler = calls[calls.length - 1][1];
			await handler('poop-1', 'rat-1');

			expect(mockChannel.send).toHaveBeenCalledWith(
				expect.objectContaining({ content: expect.stringContaining('Hit the gutter') })
			);
		});
	});

	describe('DepravityComplete handler', () => {
		test('sends message mentioning target and subhuman IDs', async () => {
			const mockChannel = { send: jest.fn().mockResolvedValue({ delete: jest.fn() }) };
			mockClient.channels.fetch.mockResolvedValue(mockChannel);
			setupPoopBotEvents(mockClient, 'msg-id');

			const calls = eventEmitter.on.mock.calls.filter(c => c[0] === 'DepravityComplete');
			const handler = calls[calls.length - 1][1];
			await handler('target-1', 'sub-1');

			expect(mockChannel.send).toHaveBeenCalledWith(
				expect.objectContaining({ content: expect.stringContaining('Hit the gutter') })
			);
		});
	});
});
