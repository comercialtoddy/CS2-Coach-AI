/**
 * @typedef {Object} PerformanceStats
 * @property {number} winRate
 * @property {number} kdRatio
 * @property {number} adr
 * @property {number} headshotPercentage
 * @property {MatchStats[]} recentMatches
 */

/**
 * @typedef {Object} MatchStats
 * @property {string} id
 * @property {string} map
 * @property {string} date
 * @property {'win' | 'loss'} result
 * @property {{team: number, opponent: number}} score
 * @property {{kills: number, deaths: number, assists: number, adr: number, hs: number}} performance
 */

/**
 * @typedef {Object} MapStats
 * @property {string} map
 * @property {number} winRate
 * @property {number} tSideWinRate
 * @property {number} ctSideWinRate
 * @property {number} entrySuccessRate
 * @property {Array<{position: string, successRate: number}>} commonPositions
 * @property {Array<{angle: string, kills: number}>} commonAngles
 */

/**
 * @typedef {Object} WeaponStats
 * @property {string} name
 * @property {'Rifle' | 'SMG' | 'Pistol' | 'Sniper' | 'Heavy'} type
 * @property {number} kills
 * @property {number} accuracy
 * @property {number} headshots
 * @property {number} damage
 */

/**
 * @typedef {Object} Settings
 * @property {{model: string, volume: number}} voice
 * @property {{model: string, responseStyle: 'concise' | 'detailed' | 'coaching'}} ai
 * @property {{showWinLossStreak: boolean, showPerformanceTrends: boolean, showMatchDetails: boolean}} display
 * @property {{performanceMilestones: boolean, matchAnalysis: boolean, personalRecords: boolean}} notifications
 */

export {}; 