// =====================
	// GLOBAL FLAGS
// =====================
let revolutionActive = false;
let revolutionSecondPhase = false;
let siegeActive = false;
let emperorElectionActive = false;
let reelectionActive = false;
let disableRevolution = true;
let disableCoup = true;
let disableSiege = true;
let struggleMethod = "Revolution";
let playerCount = 0;
let serverDown = true;
// =====================
	// PARTICIPANT STATE
// =====================
let revolutionParticipants = new Set(); 
let selectedRevolutionTargets = new Set();
let siegeParticipants = new Set();

// =====================
	// CANDIDATE TRACKING
// =====================
let candidates = null;

// =====================
	// SIZE TRACKING
// =====================
let revolutionarySize = 0;
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
	// Server Status
	isServerDown: () => serverDown,
	setServerDown: (val) => { serverDown = val; },
	// Player Count
	getPlayerCount: () => playerCount,
	setPlayerCount: (count) => { playerCount = count; },
	//struggleMethod
	setStruggleMethod: (method) => { struggleMethod = method; },
	getStruggleMethod: () => struggleMethod,
	isCoupActive: () => struggleMethod === "Coup",
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
	isRevolutionParticipant: (userId) => {
		for (const participant of revolutionParticipants) {
			if (participant.userId === userId) {
				return true;
			}
		}
	},
	getRevolutionParticipants: () => revolutionParticipants,
	addRevolutionParticipant: (role, userId, targetId) => {
		console.log(`Adding revolution participant: role=${role}, userId=${userId}, targetId=${targetId}`);
		revolutionParticipants.add({
			role: role,
			userId: userId,
			targetId: targetId
		});

	},
	removeRevolutionParticipant: (userId) => {
		let wasParticipant = false;
		for (const participant of revolutionParticipants) {
			if (participant.userId === userId) {
				revolutionParticipants.delete(participant);
				wasParticipant = true;
			}
			if (participant.targetId === userId) {
				participant.targetId = null; 
			}
		}
		return wasParticipant;
	},
	resetRevolutionParticipants: () => {
		revolutionParticipants.clear();
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
	removeRevolutionTarget: (target) => {
		selectedRevolutionTargets.delete(target);
	},
	resetRevolutionTargets: () => {
		selectedRevolutionTargets.clear();
	},
	// Revolution Size
	getRevolutionarySize: () => {
		return revolutionParticipants.size;
	},
	getRevolutionTargetsSize: () =>{
		return selectedRevolutionTargets.size;
	},
	getPeopleSize: () => {
		return roleSizes["Peasant"] + roleSizes["Scholar"] + roleSizes["Merchant"] + roleSizes["Knight"];
	},
	


	// Emperor Election
	isEmperorElectionActive: () => emperorElectionActive,
	setEmperorElectionActive: (val) => { emperorElectionActive = val; },
	isReelectionActive: () => reelectionActive,
	setReelectionActive: (val) => { reelectionActive = val; },
	// Siege
	isSiegeActive: () => siegeActive,
	setSiegeActive: (val) => { siegeActive = val; },
	addSiegeParticipant: (id) => siegeParticipants.add(id),
	removeSiegeParticipant: (id) => siegeParticipants.delete(id),
	isSiegeParticipant: (id) => siegeParticipants.has(id),
	getSiegeParticipants: () => siegeParticipants,
	getSiegeParticipantsSize: () => siegeParticipants.size,
	clearSiegeParticipants: () => siegeParticipants.clear(),
	getSiegeInitiator: () => siegeInitiator,
	setSiegeInitiator: (val) => { siegeInitiator = val; },	
	getSiegeInitiatorId: () => siegeInitiator.id,
	getSiegeTarget: () => siegeTarget,	
	getSiegeTargetId: () => siegeTarget.id,
	getSiegeTargetUsername: () => siegeTarget.user.username,
	setSiegeTarget: (val) => { siegeTarget = val; },
	getSiegeTimeout: () => siegeTimeout,
	setSiegeTimeout: (val) => { siegeTimeout = val; },
	clearSiegeTimeout: () =>{ clearTimeout(siegeTimeout);},
	removeSiegeTimeout: () => { siegeTimeout = null; },
	getDisableSiege: () => disableSiege,
	setDisableSiege: (val) => { disableSiege = val; },

	// Role Sizes
	setRoleSize: (role, size) => { roleSizes[role] = size; },
	getRoleSize: (role) => roleSizes[role],
	getHigherRoleSize: () => {
		return roleSizes["Lord"] + roleSizes["King"] + roleSizes["Noble"] +
			roleSizes["Emperor"]; 
	},
	getEmperorElectionRoleSize: () => {
		return roleSizes["Knight"] + roleSizes["Lord"] + roleSizes["King"] + roleSizes["Noble"];
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

