const gs = require('../game_state');

function resetAll() {
	gs.resetRevolution();
	gs.setServerDown(true);
	gs.setPlayerCount(0);
	gs.setSiegeActive(false);
	gs.clearSiegeParticipants();
	gs.setSiegeInitiator(null);
	gs.setSiegeTarget(null);
	gs.setEmperorElectionActive(false);
	gs.setReelectionActive(false);
	gs.setDisableRevolution(true);
	gs.setDisableCoup(true);
	gs.setDisableSiege(true);
	gs.setDisableElection(true);
	gs.setDisableAssassination(true);
	gs.setStruggleMethod('Revolution');
	['Peasant','Scholar','Merchant','Knight','Noble','Lord','King','Emperor'].forEach(r => gs.setRoleSize(r, 0));
}

beforeEach(resetAll);

describe('server status', () => {
	test('isServerDown defaults to true', () => {
		expect(gs.isServerDown()).toBe(true);
	});
	test('setServerDown false', () => {
		gs.setServerDown(false);
		expect(gs.isServerDown()).toBe(false);
	});
	test('setServerDown true', () => {
		gs.setServerDown(false);
		gs.setServerDown(true);
		expect(gs.isServerDown()).toBe(true);
	});
});

describe('player count', () => {
	test('getPlayerCount defaults to 0', () => {
		expect(gs.getPlayerCount()).toBe(0);
	});
	test('setPlayerCount updates value', () => {
		gs.setPlayerCount(42);
		expect(gs.getPlayerCount()).toBe(42);
	});
});

describe('revolution flags', () => {
	test('isRevolutionActive defaults to false', () => {
		expect(gs.isRevolutionActive()).toBe(false);
	});
	test('setRevolutionActive true', () => {
		gs.setRevolutionActive(true);
		expect(gs.isRevolutionActive()).toBe(true);
	});
	test('isRevolutionSecondPhase defaults to false', () => {
		expect(gs.isRevolutionSecondPhase()).toBe(false);
	});
	test('setRevolutionSecondPhase true', () => {
		gs.setRevolutionSecondPhase(true);
		expect(gs.isRevolutionSecondPhase()).toBe(true);
	});
	test('getDisableRevolution defaults to true', () => {
		expect(gs.getDisableRevolution()).toBe(true);
	});
	test('setDisableRevolution false', () => {
		gs.setDisableRevolution(false);
		expect(gs.getDisableRevolution()).toBe(false);
	});
	test('getDisableCoup defaults to true', () => {
		expect(gs.getDisableCoup()).toBe(true);
	});
	test('setDisableCoup false', () => {
		gs.setDisableCoup(false);
		expect(gs.getDisableCoup()).toBe(false);
	});
});

describe('revolution participants', () => {
	test('addRevolutionParticipant adds entry', () => {
		gs.addRevolutionParticipant('Peasant', 'u1', 't1');
		expect(gs.getRevolutionParticipants().size).toBe(1);
	});
	test('getRevolutionarySize returns count', () => {
		gs.addRevolutionParticipant('Peasant', 'u1', 't1');
		gs.addRevolutionParticipant('Scholar', 'u2', 't2');
		expect(gs.getRevolutionarySize()).toBe(2);
	});
	test('isRevolutionParticipant returns true for existing participant', () => {
		gs.addRevolutionParticipant('Peasant', 'u1', 't1');
		expect(gs.isRevolutionParticipant('u1')).toBe(true);
	});
	test('isRevolutionParticipant returns undefined for non-participant', () => {
		expect(gs.isRevolutionParticipant('unknown')).toBeUndefined();
	});
	test('removeRevolutionParticipant removes and returns true', () => {
		gs.addRevolutionParticipant('Peasant', 'u1', 't1');
		expect(gs.removeRevolutionParticipant('u1')).toBe(true);
		expect(gs.getRevolutionarySize()).toBe(0);
	});
	test('removeRevolutionParticipant returns false for unknown', () => {
		expect(gs.removeRevolutionParticipant('nobody')).toBe(false);
	});
	test('removeRevolutionParticipant nulls targetId when user is a target', () => {
		gs.addRevolutionParticipant('Peasant', 'u1', 'target1');
		gs.removeRevolutionParticipant('target1');
		const [p] = Array.from(gs.getRevolutionParticipants());
		expect(p.targetId).toBeNull();
	});
	test('resetRevolutionParticipants clears the set', () => {
		gs.addRevolutionParticipant('Peasant', 'u1', 't1');
		gs.resetRevolutionParticipants();
		expect(gs.getRevolutionarySize()).toBe(0);
	});
	test('resetRevolution resets all revolution state', () => {
		gs.setRevolutionActive(true);
		gs.setRevolutionSecondPhase(true);
		gs.addRevolutionParticipant('Peasant', 'u1', 't1');
		gs.setStruggleMethod('Coup');
		gs.setEmperorElectionActive(true);
		gs.resetRevolution();
		expect(gs.isRevolutionActive()).toBe(false);
		expect(gs.isRevolutionSecondPhase()).toBe(false);
		expect(gs.getRevolutionarySize()).toBe(0);
		expect(gs.getStruggleMethod()).toBe('Revolution');
	});
});

describe('getCivilParticipants', () => {
	test('excludes knights', () => {
		gs.addRevolutionParticipant('Peasant', 'p1', 't1');
		gs.addRevolutionParticipant('Knight', 'k1', 't2');
		expect(gs.getCivilParticipants().size).toBe(1);
	});
	test('includes non-knight roles', () => {
		gs.addRevolutionParticipant('Scholar', 'u1', 't1');
		gs.addRevolutionParticipant('Merchant', 'u2', 't2');
		expect(gs.getCivilParticipants().size).toBe(2);
	});
	test('returns empty set when no participants', () => {
		expect(gs.getCivilParticipants().size).toBe(0);
	});
});

describe('getKnightParticipants', () => {
	test('includes only knights', () => {
		gs.addRevolutionParticipant('Peasant', 'p1', 't1');
		gs.addRevolutionParticipant('Knight', 'k1', 't2');
		expect(gs.getKnightParticipants().size).toBe(1);
	});
	test('returns empty set when no knights', () => {
		gs.addRevolutionParticipant('Peasant', 'p1', 't1');
		expect(gs.getKnightParticipants().size).toBe(0);
	});
});

describe('revolution targets', () => {
	test('addSelectedRevolutionTarget adds entry', () => {
		gs.addSelectedRevolutionTarget('t1', 2);
		expect(gs.getRevolutionTargetsSize()).toBe(1);
	});
	test('checkSelectedRevolutionTarget returns true for added target', () => {
		gs.addSelectedRevolutionTarget('t1', 2);
		expect(gs.checkSelectedRevolutionTarget('t1')).toBe(true);
	});
	test('checkSelectedRevolutionTarget returns false for missing target', () => {
		expect(gs.checkSelectedRevolutionTarget('nobody')).toBe(false);
	});
	test('removeRevolutionTarget removes entry', () => {
		gs.addSelectedRevolutionTarget('t1', 2);
		const [target] = Array.from(gs.getSelectedRevolutionTargets());
		gs.removeRevolutionTarget(target);
		expect(gs.getRevolutionTargetsSize()).toBe(0);
	});
	test('resetRevolutionTargets clears all', () => {
		gs.addSelectedRevolutionTarget('t1', 1);
		gs.addSelectedRevolutionTarget('t2', 2);
		gs.resetRevolutionTargets();
		expect(gs.getRevolutionTargetsSize()).toBe(0);
	});
});

describe('siege', () => {
	test('isSiegeActive defaults to false', () => {
		expect(gs.isSiegeActive()).toBe(false);
	});
	test('setSiegeActive true', () => {
		gs.setSiegeActive(true);
		expect(gs.isSiegeActive()).toBe(true);
	});
	test('addSiegeParticipant / isSiegeParticipant', () => {
		gs.addSiegeParticipant('u1');
		expect(gs.isSiegeParticipant('u1')).toBe(true);
		expect(gs.isSiegeParticipant('u2')).toBe(false);
	});
	test('removeSiegeParticipant', () => {
		gs.addSiegeParticipant('u1');
		gs.removeSiegeParticipant('u1');
		expect(gs.isSiegeParticipant('u1')).toBe(false);
	});
	test('getSiegeParticipantsSize', () => {
		gs.addSiegeParticipant('u1');
		gs.addSiegeParticipant('u2');
		expect(gs.getSiegeParticipantsSize()).toBe(2);
	});
	test('clearSiegeParticipants', () => {
		gs.addSiegeParticipant('u1');
		gs.clearSiegeParticipants();
		expect(gs.getSiegeParticipantsSize()).toBe(0);
	});
	test('setSiegeInitiator / getSiegeInitiator / getSiegeInitiatorId', () => {
		const obj = { id: 'king1' };
		gs.setSiegeInitiator(obj);
		expect(gs.getSiegeInitiator()).toBe(obj);
		expect(gs.getSiegeInitiatorId()).toBe('king1');
	});
	test('setSiegeTarget / getSiegeTarget / getSiegeTargetId / getSiegeTargetUsername', () => {
		const obj = { id: 'king2', user: { username: 'King2User' } };
		gs.setSiegeTarget(obj);
		expect(gs.getSiegeTarget()).toBe(obj);
		expect(gs.getSiegeTargetId()).toBe('king2');
		expect(gs.getSiegeTargetUsername()).toBe('King2User');
	});
	test('getDisableSiege defaults to true', () => {
		expect(gs.getDisableSiege()).toBe(true);
	});
	test('setDisableSiege false', () => {
		gs.setDisableSiege(false);
		expect(gs.getDisableSiege()).toBe(false);
	});
});

describe('emperor election', () => {
	test('isEmperorElectionActive defaults to false', () => {
		expect(gs.isEmperorElectionActive()).toBe(false);
	});
	test('setEmperorElectionActive true', () => {
		gs.setEmperorElectionActive(true);
		expect(gs.isEmperorElectionActive()).toBe(true);
	});
	test('isReelectionActive defaults to false', () => {
		expect(gs.isReelectionActive()).toBe(false);
	});
	test('setReelectionActive true', () => {
		gs.setReelectionActive(true);
		expect(gs.isReelectionActive()).toBe(true);
	});
});

describe('disable flags', () => {
	test('getDisableElection defaults to true', () => {
		expect(gs.getDisableElection()).toBe(true);
	});
	test('setDisableElection false', () => {
		gs.setDisableElection(false);
		expect(gs.getDisableElection()).toBe(false);
	});
	test('getDisableAssassination defaults to true', () => {
		expect(gs.getDisableAssassination()).toBe(true);
	});
	test('setDisableAssassination false', () => {
		gs.setDisableAssassination(false);
		expect(gs.getDisableAssassination()).toBe(false);
	});
});

describe('struggle method', () => {
	test('getStruggleMethod defaults to Revolution', () => {
		expect(gs.getStruggleMethod()).toBe('Revolution');
	});
	test('isCoupActive false by default', () => {
		expect(gs.isCoupActive()).toBe(false);
	});
	test('isCoupActive true when set to Coup', () => {
		gs.setStruggleMethod('Coup');
		expect(gs.isCoupActive()).toBe(true);
	});
	test('isCoupActive false when reverted to Revolution', () => {
		gs.setStruggleMethod('Coup');
		gs.setStruggleMethod('Revolution');
		expect(gs.isCoupActive()).toBe(false);
	});
});

describe('role sizes', () => {
	test('getRoleSize returns 0 by default', () => {
		expect(gs.getRoleSize('Peasant')).toBe(0);
	});
	test('setRoleSize / getRoleSize roundtrip', () => {
		gs.setRoleSize('Knight', 5);
		expect(gs.getRoleSize('Knight')).toBe(5);
	});
	test('getPeopleSize sums Peasant + Scholar + Merchant + Knight', () => {
		gs.setRoleSize('Peasant', 3);
		gs.setRoleSize('Scholar', 2);
		gs.setRoleSize('Merchant', 1);
		gs.setRoleSize('Knight', 4);
		expect(gs.getPeopleSize()).toBe(10);
	});
	test('getPeopleSize ignores upper roles', () => {
		gs.setRoleSize('Noble', 5);
		gs.setRoleSize('King', 2);
		expect(gs.getPeopleSize()).toBe(0);
	});
	test('getHigherRoleSize sums Lord + King + Noble + Emperor', () => {
		gs.setRoleSize('Lord', 2);
		gs.setRoleSize('King', 1);
		gs.setRoleSize('Noble', 3);
		gs.setRoleSize('Emperor', 1);
		expect(gs.getHigherRoleSize()).toBe(7);
	});
	test('getEmperorElectionRoleSize sums Knight + Lord + King + Noble', () => {
		gs.setRoleSize('Knight', 3);
		gs.setRoleSize('Lord', 2);
		gs.setRoleSize('King', 1);
		gs.setRoleSize('Noble', 4);
		expect(gs.getEmperorElectionRoleSize()).toBe(10);
	});
	test('getAllRoleSizes returns snapshot of all 8 roles', () => {
		gs.setRoleSize('Peasant', 5);
		const sizes = gs.getAllRoleSizes();
		expect(sizes.Peasant).toBe(5);
		expect(Object.keys(sizes).length).toBe(8);
	});
	test('getAllRoleSizes returns a copy, not the original reference', () => {
		const sizes = gs.getAllRoleSizes();
		sizes.Peasant = 999;
		expect(gs.getRoleSize('Peasant')).toBe(0);
	});
});
