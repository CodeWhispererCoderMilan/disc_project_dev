// =====================
	// GLOBAL FLAGS
// =====================
let revolutionActive = false;
let revolutionSecondPhase = false;
let coupActive = false;
let siegeActive = false;
let emperorElectionActive = false;
let reelectionActive = false;
let disableRevolution = true;
let disableCoup = true;
let struggleMethod = "Revolution";
// =====================
	// PARTICIPANT STATE
// =====================
let revolutionParticipants = new Set(); 
let selectedRevolutionTargets = new Set();
let coupParticipants = new Set();
let siegeParticipants = new Set();

// =====================
	// CANDIDATE TRACKING
// =====================
let candidates = null;

// =====================
	// SIZE TRACKING
// =====================
let revolutionarySize = 0;
let peopleSize = 0;
let roleSizes = {
	Peasant: 0,
	Scholar: 0,
	Merchant: 0,
	Knight: 0,
	Noble: 0,
	Lord: 0,
	King: 0,
	Emperor: 0,
};
let knights = [];
let knightsSize = 0;
let kingsSize = 0;

// =====================
	// SIEGE TARGET INFO
// =====================
	let siegeInitiator = null;
let siegeTarget = null;
let siegeTimeout = null;

module.exports = {
	//struggleMethod
	setStruggleMethod: (method) => { struggleMethod = method; },
	// Revolution Flags
	isRevolutionActive: () => revolutionActive,
	setRevolutionActive: (val) => { revolutionActive = val; },
	isRevolutionSecondPhase: () => revolutionSecondPhase,
	setRevolutionSecondPhase: (val) => { revolutionSecondPhase = val; },
	getDisableRevolution: () => disableRevolution,
	setDisableRevolution: (val) => { disableRevolution = val; },
	getDisableCoup: () => disableCoup,
	setDisableCoup: (val) => { disableCoup = val; },
	// Revolution Participants
	getCivilParticipants: () => {
		const civilParticipants = new Set(
			Array.from(revolutionParticipants).filter(participant => participant.role !="Knight")
		);
		return civilParticipants;
	},
	getKnightParticipants: () => {
		const knightParticipants = new Set(
			Array.from(revolutionParticipants).filter(participant => participant.role === "Knight")
		);
		return knightParticipants;
	},
	getRevolutionParticipants: () => revolutionParticipants,
	addRevolutionParticipant: (role, userId, targetId) => {
		revolutionParticipants.add({
			role: role,
			userId: userId,
			targetId: targetId
		});

	},
	removeRevolutionParticipant: (userId) => {
		for (const participant of revolutionParticipants) {
			if (participant.userId === userId) {
				revolutionParticipants.delete(participant);
			}
			if (participant.targetId === userId) {
				participant.targetId = null; 
			}
		}
	},
	resetRevolutionParticipants: () => {
		revolutionParticipants.clear();
		selectedRevolutionTargets.clear();
	},
	resetRevolution:() => {
		revolutionActive = false;
		revolutionSecondPhase = false;
		revolutionParticipants = new Set();
		coupActive = false;
		emperorElectionActive = false;
		struggleMethod = "Revolution";
		selectedRevolutionTargets.clear();
	},
	getSelectedRevolutionTargets: () => selectedRevolutionTargets,
	checkSelectedRevolutionTarget: (targetId) => {
		for (const target of selectedRevolutionTargets) {
			if (target.targetId === targetId) {
				return true;
			}
		}
		return false;
	},	
	addSelectedRevolutionTarget: (targetId, targetCount) => {
		selectedRevolutionTargets.add({
			targetId: targetId,
			targetCount: targetCount
		});
	},
	// Revolution Size
	getRevolutionarySize: () => {
		return revolutionParticipants.size;
	},
	getPeopleSize: () => peopleSize,

	// Coup
	isCoupActive: () => coupActive,
	setCoupActive: (val) => { coupActive = val; },
	addCoupParticipant: (id) => coupParticipants.add(id),
	removeCoupParticipant: (id) => coupParticipants.delete(id),
	isCoupParticipant: (id) => coupParticipants.has(id),
	getCoupParticipants: () => Array.from(coupParticipants),
	clearCoupParticipants: () => coupParticipants.clear(),

	// Emperor Election
	isEmperorElectionActive: () => emperorElectionActive,
	setEmperorElectionActive: (val) => { emperorElectionActive = val; },
	isReelectionActive: () => reelectionActive,
	setReelectionActive: (val) => { reelectionActive = val; },
	getCandidates: () => candidates,
	setCandidates: (val) => { candidates = val; },

	// Siege
	isSiegeActive: () => siegeActive,
	setSiegeActive: (val) => { siegeActive = val; },
	addSiegeParticipant: (id) => siegeParticipants.add(id),
	removeSiegeParticipant: (id) => siegeParticipants.delete(id),
	isSiegeParticipant: (id) => siegeParticipants.has(id),
	getSiegeParticipants: () => Array.from(siegeParticipants),
	clearSiegeParticipants: () => siegeParticipants.clear(),
	getSiegeInitiator: () => siegeInitiator,
	setSiegeInitiator: (val) => { siegeInitiator = val; },
	getSiegeTarget: () => siegeTarget,
	setSiegeTarget: (val) => { siegeTarget = val; },
	getSiegeTimeout: () => siegeTimeout,
	setSiegeTimeout: (val) => { siegeTimeout = val; },

	// Role Sizes
	setRoleSize: (role, size) => { roleSizes[role] = size; },
	getRoleSize: (role) => roleSizes[role],
	getHigherRoleSize: () => {
		return roleSizes["Lord"] + roleSizes["King"] + roleSizes["Noble"];
	},
	getAllRoleSizes: () => ({ ...roleSizes }),

	// Knight & King Sizes
	setKnights: (arr) => { knights = arr; },
	getKnights: () => knights,
	setKnightsSize: (val) => { knightsSize = val; },
	getKnightsSize: () => knightsSize,
	setKingsSize: (val) => { kingsSize = val; },
	getKingsSize: () => kingsSize,
};

