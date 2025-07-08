import { ITool, ToolCategory, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema } from '../interfaces/ITool.js';
import { CSGO } from 'csgogsi';
import { GSIInputHandler } from '../orchestrator/GSIDataModel.js';

interface AnalyzePositioningInput {
  playerData: {
    position: { x: number; y: number; z: number };
    teamSide: 'CT' | 'T';
    health: number;
    weapons: Record<string, any>;
    steamId: string;
  };
  mapContext: {
    mapName: string;
    phase: 'freezetime' | 'live' | 'over' | 'warmup';
    bombPlanted: boolean;
    bombsite?: 'A' | 'B';
    roundTime: number;
  };
  teamState: {
    aliveTeammates: number;
    aliveEnemies: number;
    teammatePositions: Array<{ x: number; y: number; z: number }>;
  };
}

interface AnalyzePositioningOutput {
  positionQuality: number; // 0-1 score
  risks: string[];
  recommendations: string[];
  tacticalAdvantages: string[];
  immediateActions: string[];
  analysis: {
    crossfireSetup: number; // 0-1 score
    tradePotential: number; // 0-1 score
    coverUsage: number; // 0-1 score
    angleIsolation: number; // 0-1 score
    mapControl: number; // 0-1 score
  };
}

export class AnalyzePositioningTool implements ITool<AnalyzePositioningInput, AnalyzePositioningOutput> {
  private currentMap: string = 'de_dust2';

  public readonly name = 'Tool_AnalyzePositioning';
  public readonly description = 'Analyzes player positioning based on GSI data and map context';
  public readonly metadata = {
    category: ToolCategory.ANALYSIS,
    version: '1.0.0',
    requiresGSI: true,
    tags: ['positioning', 'analysis', 'gsi', 'tactical']
  };

  public readonly inputSchema: Record<string, ToolParameterSchema> = {
    playerData: {
      type: 'object' as const,
      required: true,
      description: 'Player state data including position, team, health, and equipment',
      properties: {
        position: {
          type: 'object' as const,
          required: true,
          description: '3D coordinates of the player position',
          properties: {
            x: { type: 'number' as const, required: true, description: 'X coordinate' },
            y: { type: 'number' as const, required: true, description: 'Y coordinate' },
            z: { type: 'number' as const, required: true, description: 'Z coordinate' }
          }
        },
        teamSide: { type: 'string' as const, required: true, enum: ['CT', 'T'], description: 'Player team side (CT or T)' },
        health: { type: 'number' as const, required: true, description: 'Current player health' },
        weapons: { type: 'object' as const, required: true, description: 'Player weapon inventory' },
        steamId: { type: 'string' as const, required: true, description: 'Player Steam ID' }
      }
    },
    mapContext: {
      type: 'object' as const,
      required: true,
      description: 'Current map and round state information',
      properties: {
        mapName: { type: 'string' as const, required: true, description: 'Name of the current map' },
        phase: { type: 'string' as const, required: true, enum: ['freezetime', 'live', 'over', 'warmup'], description: 'Current game phase' },
        bombPlanted: { type: 'boolean' as const, required: true, description: 'Whether the bomb is planted' },
        bombsite: { type: 'string' as const, enum: ['A', 'B'], description: 'Bombsite where the bomb is planted (if applicable)' },
        roundTime: { type: 'number' as const, required: true, description: 'Current round time in seconds' }
      }
    },
    teamState: {
      type: 'object' as const,
      required: true,
      description: 'Current state of both teams',
      properties: {
        aliveTeammates: { type: 'number' as const, required: true, description: 'Number of alive teammates' },
        aliveEnemies: { type: 'number' as const, required: true, description: 'Number of alive enemies' },
        teammatePositions: {
          type: 'array' as const,
          required: true,
          description: 'Array of teammate positions',
          items: {
            type: 'object' as const,
            description: '3D coordinates of a teammate position',
            properties: {
              x: { type: 'number' as const, required: true, description: 'X coordinate' },
              y: { type: 'number' as const, required: true, description: 'Y coordinate' },
              z: { type: 'number' as const, required: true, description: 'Z coordinate' }
            }
          }
        }
      }
    }
  };

  public readonly outputExample: AnalyzePositioningOutput = {
    positionQuality: 0.75,
    risks: ['Exposed to long angles', 'Limited trade potential'],
    recommendations: ['Move closer to cover', 'Coordinate with teammates'],
    tacticalAdvantages: ['Strong crossfire position', 'Good map control'],
    immediateActions: ['URGENT: Seek immediate cover'],
    analysis: {
      crossfireSetup: 0.8,
      tradePotential: 0.6,
      coverUsage: 0.7,
      angleIsolation: 0.5,
      mapControl: 0.9
    }
  };

  public validateInput(input: AnalyzePositioningInput): { isValid: boolean; errors?: { parameter: string; message: string; receivedType?: string; expectedType?: string; }[] } {
    const errors: { parameter: string; message: string; receivedType?: string; expectedType?: string; }[] = [];

    // Basic validation
    if (!input.playerData || !input.mapContext || !input.teamState) {
      return {
        isValid: false,
        errors: [
          {
            parameter: 'input',
            message: 'Missing required top-level properties',
            expectedType: 'object with playerData, mapContext, and teamState'
          }
        ]
      };
    }

    // Player data validation
    const { position, teamSide, health, weapons, steamId } = input.playerData;
    if (!position) {
      errors.push({
        parameter: 'playerData.position',
        message: 'Missing position data',
        expectedType: 'object with x, y, z coordinates'
      });
    } else {
      if (typeof position.x !== 'number') {
        errors.push({
          parameter: 'playerData.position.x',
          message: 'Invalid x coordinate',
          receivedType: typeof position.x,
          expectedType: 'number'
        });
      }
      if (typeof position.y !== 'number') {
        errors.push({
          parameter: 'playerData.position.y',
          message: 'Invalid y coordinate',
          receivedType: typeof position.y,
          expectedType: 'number'
        });
      }
      if (typeof position.z !== 'number') {
        errors.push({
          parameter: 'playerData.position.z',
          message: 'Invalid z coordinate',
          receivedType: typeof position.z,
          expectedType: 'number'
        });
      }
    }

    if (!teamSide || !['CT', 'T'].includes(teamSide)) {
      errors.push({
        parameter: 'playerData.teamSide',
        message: 'Invalid team side',
        receivedType: teamSide,
        expectedType: 'CT or T'
      });
    }

    if (typeof health !== 'number') {
      errors.push({
        parameter: 'playerData.health',
        message: 'Invalid health value',
        receivedType: typeof health,
        expectedType: 'number'
      });
    }

    if (!weapons || typeof weapons !== 'object') {
      errors.push({
        parameter: 'playerData.weapons',
        message: 'Invalid weapons data',
        receivedType: typeof weapons,
        expectedType: 'object'
      });
    }

    if (!steamId || typeof steamId !== 'string') {
      errors.push({
        parameter: 'playerData.steamId',
        message: 'Invalid steam ID',
        receivedType: typeof steamId,
        expectedType: 'string'
      });
    }

    // Map context validation
    const { mapName, phase, bombPlanted, roundTime } = input.mapContext;
    if (!mapName || typeof mapName !== 'string') {
      errors.push({
        parameter: 'mapContext.mapName',
        message: 'Invalid map name',
        receivedType: typeof mapName,
        expectedType: 'string'
      });
    }

    if (!phase || !['freezetime', 'live', 'over', 'warmup'].includes(phase)) {
      errors.push({
        parameter: 'mapContext.phase',
        message: 'Invalid game phase',
        receivedType: phase,
        expectedType: 'freezetime, live, over, or warmup'
      });
    }

    if (typeof bombPlanted !== 'boolean') {
      errors.push({
        parameter: 'mapContext.bombPlanted',
        message: 'Invalid bomb planted status',
        receivedType: typeof bombPlanted,
        expectedType: 'boolean'
      });
    }

    if (typeof roundTime !== 'number') {
      errors.push({
        parameter: 'mapContext.roundTime',
        message: 'Invalid round time',
        receivedType: typeof roundTime,
        expectedType: 'number'
      });
    }

    // Team state validation
    const { aliveTeammates, aliveEnemies, teammatePositions } = input.teamState;
    if (typeof aliveTeammates !== 'number') {
      errors.push({
        parameter: 'teamState.aliveTeammates',
        message: 'Invalid alive teammates count',
        receivedType: typeof aliveTeammates,
        expectedType: 'number'
      });
    }

    if (typeof aliveEnemies !== 'number') {
      errors.push({
        parameter: 'teamState.aliveEnemies',
        message: 'Invalid alive enemies count',
        receivedType: typeof aliveEnemies,
        expectedType: 'number'
      });
    }

    if (!Array.isArray(teammatePositions)) {
      errors.push({
        parameter: 'teamState.teammatePositions',
        message: 'Invalid teammate positions',
        receivedType: typeof teammatePositions,
        expectedType: 'array'
      });
    } else {
      teammatePositions.forEach((pos, index) => {
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number') {
          errors.push({
            parameter: `teamState.teammatePositions[${index}]`,
            message: 'Invalid teammate position coordinates',
            expectedType: 'object with x, y, z number coordinates'
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private mapData: Record<string, {
    commonPositions: {
      CT: Array<{ x: number; y: number; z: number }>;
      T: Array<{ x: number; y: number; z: number }>;
    };
    sitePositions: Record<'A' | 'B', Array<{ x: number; y: number; z: number; name: string }>>;
    dangerZones: Array<{ x1: number; y1: number; x2: number; y2: number; name: string }>;
    postPlantPositions: Record<'A' | 'B', Array<{ x: number; y: number; z: number; name: string }>>;
    bombsites: Record<'A' | 'B', { x: number; y: number; z: number }>;
    keyAreas: Array<{ x: number; y: number; z: number }>;
    chokePoints: Array<{ x: number; y: number; z: number }>;
  }> = {
    de_dust2: {
      commonPositions: {
        CT: [
          { x: 1000, y: 2000, z: 0 },
          { x: 1200, y: 2200, z: 0 }
        ],
        T: [
          { x: 0, y: 1000, z: 0 },
          { x: 200, y: 1200, z: 0 }
        ]
      },
      sitePositions: {
        A: [
          { x: 1100, y: 2100, z: 0, name: 'A Site Default' },
          { x: 1300, y: 2300, z: 0, name: 'A Site Corner' }
        ],
        B: [
          { x: 100, y: 1100, z: 0, name: 'B Site Default' },
          { x: 300, y: 1300, z: 0, name: 'B Site Corner' }
        ]
      },
      dangerZones: [
        { x1: 0, y1: 1000, x2: 200, y2: 1200, name: 'Mid Doors' }
      ],
      postPlantPositions: {
        A: [
          { x: 1100, y: 2100, z: 0, name: 'Post Plant A' },
          { x: 1300, y: 2300, z: 0, name: 'Post Plant A Corner' }
        ],
        B: [
          { x: 100, y: 1100, z: 0, name: 'Post Plant B' },
          { x: 300, y: 1300, z: 0, name: 'Post Plant B Corner' }
        ]
      },
      bombsites: {
        A: { x: 1100, y: 2100, z: 0 },
        B: { x: 100, y: 1100, z: 0 }
      },
      keyAreas: [
        { x: 1000, y: 2000, z: 0 },
        { x: 0, y: 1000, z: 0 }
      ],
      chokePoints: [
        { x: 1000, y: 2000, z: 0 },
        { x: 0, y: 1000, z: 0 }
      ]
    }
  };

  async execute(input: AnalyzePositioningInput, context: ToolExecutionContext): Promise<ToolExecutionResult<AnalyzePositioningOutput>> {
    try {
      if (!this.validateInput(input)) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input data provided',
            details: { input }
          }
        };
      }

      const { playerData, mapContext, teamState } = input;
      
      // Initialize analysis scores
      const analysis = {
        crossfireSetup: this.analyzeCrossfireSetup(playerData, teamState),
        tradePotential: this.analyzeTradePositioning(playerData, teamState),
        coverUsage: this.analyzeCoverUsage(playerData, mapContext),
        angleIsolation: this.analyzeAngleIsolation(playerData, mapContext),
        mapControl: this.analyzeMapControl(playerData, mapContext, teamState)
      };

      // Calculate overall position quality
      const positionQuality = this.calculateOverallQuality(analysis, mapContext);

      // Generate recommendations and risks
      const { risks, recommendations, tacticalAdvantages, immediateActions } = this.generateRecommendations(
        analysis,
        playerData,
        mapContext,
        teamState
      );

      // Identify tactical advantages
      const tacticalAdvantagesFinal = this.identifyTacticalAdvantages(
        analysis,
        playerData,
        mapContext
      );

      // Determine immediate actions needed
      const immediateActionsFinal = this.determineImmediateActions(
        risks,
        analysis,
        mapContext
      );

      return {
        success: true,
        data: {
          positionQuality,
          risks,
          recommendations,
          tacticalAdvantages: tacticalAdvantagesFinal,
          immediateActions: immediateActionsFinal,
          analysis
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error in position analysis',
          details: error
        }
      };
    }
  }

  private analyzeCrossfireSetup(
    playerData: AnalyzePositioningInput['playerData'],
    teamState: AnalyzePositioningInput['teamState']
  ): number {
    let score = 0;
    const minDistance = 200; // Minimum effective distance for crossfire
    const maxDistance = 1000; // Maximum effective distance for crossfire

    // Check distance and angle to teammates
    teamState.teammatePositions.forEach(teammatePos => {
      const distance = this.calculateDistance(playerData.position, teammatePos);
      if (distance >= minDistance && distance <= maxDistance) {
        score += 0.3; // Base score for good distance
        
        // Check if angles are complementary (covering different approaches)
        const angleScore = this.evaluateAngleCoverage(
          playerData.position,
          teammatePos
        );
        score += angleScore;
      }
    });

    return Math.min(score, 1); // Normalize to 0-1
  }

  private analyzeTradePositioning(
    playerData: AnalyzePositioningInput['playerData'],
    teamState: AnalyzePositioningInput['teamState']
  ): number {
    if (teamState.teammatePositions.length === 0) {
      return 0; // No trade potential without teammates
    }

    let score = 0;
    const optimalTradeDistance = 400; // Optimal distance for trade potential

    teamState.teammatePositions.forEach(teammatePos => {
      const distance = this.calculateDistance(playerData.position, teammatePos);
      const distanceScore = 1 - Math.abs(distance - optimalTradeDistance) / optimalTradeDistance;
      score += distanceScore * 0.5;

      // Check if there's a clear line of sight for trading
      if (this.hasLineOfSight(playerData.position, teammatePos)) {
        score += 0.5;
      }
    });

    return Math.min(score / teamState.teammatePositions.length, 1);
  }

  private analyzeCoverUsage(
    playerData: AnalyzePositioningInput['playerData'],
    mapContext: AnalyzePositioningInput['mapContext']
  ): number {
    // Implement cover analysis based on map geometry and common positions
    const mapData = this.mapData[mapContext.mapName];
    if (!mapData) return 0.5; // Default if map data not available

    let score = 0;
    const position = playerData.position;

    // Check distance to nearest cover points
    const coverPoints = [
      ...mapData.commonPositions.CT,
      ...mapData.commonPositions.T
    ];

    const nearestCover = coverPoints.reduce((nearest, point) => {
      const distance = this.calculateDistance(position, point);
      return distance < nearest ? distance : nearest;
    }, Infinity);

    // Score based on cover proximity
    score += Math.max(0, 1 - nearestCover / 200); // Higher score for closer cover

    return Math.min(score, 1);
  }

  private analyzeAngleIsolation(
    playerData: AnalyzePositioningInput['playerData'],
    mapContext: AnalyzePositioningInput['mapContext']
  ): number {
    const mapData = this.mapData[mapContext.mapName];
    if (!mapData) return 0.5;

    let exposedAngles = 0;
    // Assuming commonAngles is removed or replaced by commonPositions
    // For now, we'll use commonPositions as a proxy for angles
    const commonPositions = [...mapData.commonPositions.CT, ...mapData.commonPositions.T];
    commonPositions.forEach(pos => {
      if (this.isExposedToAngle(playerData.position, pos)) {
        exposedAngles++;
      }
    });

    // Score inversely proportional to number of exposed angles
    return Math.max(0, 1 - (exposedAngles / commonPositions.length));
  }

  private analyzeMapControl(
    playerData: AnalyzePositioningInput['playerData'],
    mapContext: AnalyzePositioningInput['mapContext'],
    teamState: AnalyzePositioningInput['teamState']
  ): number {
    let score = 0;
    const mapData = this.mapData[mapContext.mapName];
    if (!mapData) return 0.5;

    // Analyze control based on phase and objective
    if (mapContext.bombPlanted) {
      score = this.analyzePostPlantControl(
        playerData,
        mapContext,
        teamState,
        mapData
      );
    } else {
      score = this.analyzePrePlantControl(
        playerData,
        mapContext,
        teamState,
        mapData
      );
    }

    return Math.min(score, 1);
  }

  private calculateOverallQuality(
    analysis: AnalyzePositioningOutput['analysis'],
    mapContext: AnalyzePositioningInput['mapContext']
  ): number {
    // Weight factors based on game phase
    const weights = this.getPhaseWeights(mapContext);

    return (
      analysis.crossfireSetup * weights.crossfire +
      analysis.tradePotential * weights.trade +
      analysis.coverUsage * weights.cover +
      analysis.angleIsolation * weights.angle +
      analysis.mapControl * weights.control
    ) / Object.values(weights).reduce((a, b) => a + b, 0);
  }

  private generateRecommendations(
    analysis: AnalyzePositioningOutput['analysis'],
    playerData: AnalyzePositioningInput['playerData'],
    mapContext: AnalyzePositioningInput['mapContext'],
    teamState: AnalyzePositioningInput['teamState']
  ): {
    risks: string[];
    recommendations: string[];
    tacticalAdvantages: string[];
    immediateActions: string[];
  } {
    const risks: string[] = [];
    const recommendations: string[] = [];
    const tacticalAdvantages: string[] = [];
    const immediateActions: string[] = [];

    // Get map data
    const mapData = this.mapData[mapContext.mapName];
    if (!mapData) {
      risks.push('Unknown map data - limited analysis available');
      recommendations.push('Play cautiously due to unknown map layout');
      return { risks, recommendations, tacticalAdvantages, immediateActions };
    }

    // Analyze crossfire setup
    if (analysis.crossfireSetup < 0.4) {
      risks.push('Isolated from teammate crossfire setup');
      
      // Find nearest teammate
      const nearestTeammate = teamState.teammatePositions.reduce((nearest, pos) => {
        const distance = this.calculateDistance(playerData.position, pos);
        return distance < nearest.distance ? { position: pos, distance } : nearest;
      }, { position: teamState.teammatePositions[0], distance: Infinity });

      // Suggest repositioning for crossfire
      if (nearestTeammate.distance < 1000) {
        const angleScore = this.evaluateAngleCoverage(playerData.position, nearestTeammate.position);
        if (angleScore < 0.5) {
          recommendations.push('Adjust position to establish crossfire with teammate');
        }
      } else {
        recommendations.push('Move closer to teammates for crossfire positions');
      }
    } else {
      tacticalAdvantages.push('Good crossfire setup with teammates');
    }

    // Analyze trade potential
    if (analysis.tradePotential < 0.4) {
      risks.push('Poor trade position relative to teammates');

      // Find best trade position
      const tradePositions = mapData.commonPositions[playerData.teamSide];
      const bestTradePos = tradePositions.reduce((best, pos) => {
        const tradeScore = this.evaluateTradePosition(pos, teamState.teammatePositions);
        return tradeScore > best.score ? { position: pos, score: tradeScore } : best;
      }, { position: tradePositions[0], score: 0 });

      if (bestTradePos.score > 0.6) {
        const locationDesc = this.getLocationDescription(bestTradePos.position, mapContext.mapName);
        recommendations.push(`Move to better trade position at ${locationDesc}`);
      }
    } else {
      tacticalAdvantages.push('Good trade potential with teammates');
    }

    // Analyze cover usage
    if (analysis.coverUsage < 0.4) {
      risks.push('Exposed position with limited cover');
      recommendations.push('Move to a position with better cover');
      
      // Find nearest safe position
      const safePositions = [
        ...mapData.commonPositions[playerData.teamSide],
        ...mapData.sitePositions.A,
        ...mapData.sitePositions.B
      ];

      const nearestSafe = safePositions.reduce((nearest, pos) => {
        const distance = this.calculateDistance(playerData.position, pos);
        return distance < nearest.distance ? { position: pos, distance } : nearest;
      }, { position: safePositions[0], distance: Infinity });

      const locationDesc = this.getLocationDescription(nearestSafe.position, mapContext.mapName);
      immediateActions.push(`Move to safer position at ${locationDesc}`);
    } else {
      tacticalAdvantages.push('Good cover usage');
    }

    // Analyze angle isolation
    if (analysis.angleIsolation < 0.4) {
      risks.push('Exposed to multiple angles');
      recommendations.push('Isolate angles by using cover or repositioning');
    } else {
      tacticalAdvantages.push('Good angle isolation');
    }

    // Analyze map control
    if (analysis.mapControl < 0.4) {
      risks.push('Weak map control position');

      // Check if in post-plant situation
      if (mapContext.bombPlanted) {
        const bombsite = mapContext.bombsite || 'A';
        const postPlantPositions = mapData.postPlantPositions[bombsite];
        
        if (postPlantPositions) {
          const bestPostPlant = postPlantPositions.reduce((best, pos) => {
            const controlScore = this.evaluatePostPlantControl(pos, teamState.teammatePositions);
            return controlScore > best.score ? { position: pos, score: controlScore } : best;
          }, { position: postPlantPositions[0], score: 0 });

          const locationDesc = this.getLocationDescription(bestPostPlant.position, mapContext.mapName);
          recommendations.push(`Take post-plant position at ${locationDesc}`);
          recommendations.push('Defend the planted bomb');
        }
      } else {
        const keyAreas = mapData.keyAreas;
        const uncontrolledAreas = keyAreas.filter(area => 
          this.calculateDistance(playerData.position, area) > 500
        );

        if (uncontrolledAreas.length > 0) {
          const nearestArea = uncontrolledAreas.reduce((nearest, area) => {
            const distance = this.calculateDistance(playerData.position, area);
            return distance < nearest.distance ? { position: area, distance } : nearest;
          }, { position: uncontrolledAreas[0], distance: Infinity });

          const locationDesc = this.getLocationDescription(nearestArea.position, mapContext.mapName);
          recommendations.push(`Move to control key area at ${locationDesc}`);
        }
      }
    } else {
      tacticalAdvantages.push('Strong map control position');
    }

    // Handle extreme team state scenarios
    if (teamState.aliveTeammates === 0) {
      risks.push('Last player alive - high risk situation');
      recommendations.push('Play for survival and defensive positioning');
      recommendations.push('Save weapons if economy is critical');
      immediateActions.push('URGENT: Take defensive position with escape route');
    }

    // Handle invalid positions
    if (
      Math.abs(playerData.position.x) > 10000 ||
      Math.abs(playerData.position.y) > 10000 ||
      Math.abs(playerData.position.z) > 10000
    ) {
      risks.push('Invalid position detected - outside playable area');
      immediateActions.push('URGENT: Return to playable area');
    }

    // Handle missing teammate positions
    if (teamState.teammatePositions.length === 0 && teamState.aliveTeammates > 0) {
      risks.push('Teammate position data unavailable - limited analysis');
      recommendations.push('Play cautiously until teammate positions are known');
    }

    // Handle retake scenarios
    if (mapContext.bombPlanted && playerData.teamSide === 'CT') {
      recommendations.push('Coordinate with team for retake execution');
      recommendations.push('Support teammates during retake');
      if (mapContext.roundTime < 40) {
        immediateActions.push('URGENT: Execute retake now - limited time');
      }
    }

    // Handle execute scenarios
    if (!mapContext.bombPlanted && playerData.teamSide === 'T' && teamState.aliveTeammates >= 3) {
      const nearSite = this.isNearSite(playerData.position, mapData);
      if (nearSite) {
        recommendations.push('Prepare for site execute with team');
        recommendations.push('Support entry fraggers');
        if (analysis.tradePotential > 0.7) {
          recommendations.push('Ready for entry with good trade setup');
        }
      }
    }

    return { risks, recommendations, tacticalAdvantages, immediateActions };
  }

  private evaluateTradePosition(
    position: { x: number; y: number; z: number },
    teammatePositions: Array<{ x: number; y: number; z: number }>
  ): number {
    // Calculate average trade potential with all teammates
    const tradeScores = teammatePositions.map(teammate => {
      const distance = this.calculateDistance(position, teammate);
      const distanceScore = Math.max(0, 1 - Math.abs(distance - 400) / 400); // 400 units is optimal trade distance

      const hasLineOfSight = this.hasLineOfSight(position, teammate);
      const lineOfSightScore = hasLineOfSight ? 1 : 0;

      return (distanceScore * 0.7 + lineOfSightScore * 0.3);
    });

    return tradeScores.reduce((sum, score) => sum + score, 0) / tradeScores.length;
  }

  private evaluatePostPlantControl(
    position: { x: number; y: number; z: number },
    teammatePositions: Array<{ x: number; y: number; z: number }>
  ): number {
    // Calculate control score based on:
    // 1. Distance to teammates (want some spread)
    const avgTeammateDistance = teammatePositions.reduce((sum, teammate) => {
      return sum + this.calculateDistance(position, teammate);
    }, 0) / teammatePositions.length;
    const spreadScore = Math.max(0, 1 - Math.abs(avgTeammateDistance - 800) / 800); // 800 units optimal spread

    // 2. Crossfire potential
    const crossfireScores = teammatePositions.map(teammate => 
      this.evaluateAngleCoverage(position, teammate)
    );
    const crossfireScore = Math.max(...crossfireScores);

    // 3. Cover availability
    const coverScore = this.evaluateCoverAvailability(position);

    return (spreadScore * 0.3 + crossfireScore * 0.4 + coverScore * 0.3);
  }

  private evaluateCoverAvailability(
    position: { x: number; y: number; z: number }
  ): number {
    const mapData = this.mapData[this.currentMap];
    if (!mapData) return 0;

    // Find nearest cover point
    const coverPoints = [
      ...mapData.commonPositions.CT,
      ...mapData.commonPositions.T
    ];

    const nearestCoverDistance = coverPoints.reduce((nearest, cover) => {
      const distance = this.calculateDistance(position, cover);
      return Math.min(nearest, distance);
    }, Infinity);

    // Score based on distance to cover (closer is better)
    return Math.max(0, 1 - nearestCoverDistance / 300); // 300 units is optimal cover distance
  }

  private countExposedAngles(
    position: { x: number; y: number; z: number },
    mapData: typeof this.mapData[string]
  ): number {
    // Use common positions as potential threat angles
    const angles = [
      ...mapData.commonPositions.CT,
      ...mapData.commonPositions.T
    ];

    return angles.filter(angle => 
      this.isExposedToAngle(position, angle)
    ).length;
  }

  private getPositionDescription(
    position: { x: number; y: number; z: number }
  ): string {
    // In a real implementation, this would map coordinates to named locations
    // For now, return a simple coordinate description
    return `(${Math.round(position.x)}, ${Math.round(position.y)})`;
  }

  private identifyTacticalAdvantages(
    analysis: AnalyzePositioningOutput['analysis'],
    playerData: AnalyzePositioningInput['playerData'],
    mapContext: AnalyzePositioningInput['mapContext']
  ): string[] {
    const advantages: string[] = [];

    if (analysis.crossfireSetup > 0.7) {
      advantages.push('Strong crossfire setup with teammates');
    }

    if (analysis.tradePotential > 0.7) {
      advantages.push('Excellent trade positioning');
    }

    if (analysis.coverUsage > 0.7) {
      advantages.push('Well-protected position with good cover');
    }

    if (analysis.angleIsolation > 0.7) {
      advantages.push('Limited exposure to enemy angles');
    }

    if (analysis.mapControl > 0.7) {
      advantages.push('Strong map control position');
    }

    return advantages;
  }

  private determineImmediateActions(
    risks: string[],
    analysis: AnalyzePositioningOutput['analysis'],
    mapContext: AnalyzePositioningInput['mapContext']
  ): string[] {
    const actions: string[] = [];
    const criticalThreshold = 0.3;

    // Prioritize immediate actions based on critical risks
    Object.entries(analysis).forEach(([aspect, score]) => {
      if (score < criticalThreshold) {
        switch (aspect) {
          case 'crossfireSetup':
            actions.push('URGENT: Reposition to support teammate crossfire');
            break;
          case 'tradePotential':
            actions.push('URGENT: Move closer to teammates');
            break;
          case 'coverUsage':
            actions.push('URGENT: Seek immediate cover');
            break;
          case 'angleIsolation':
            actions.push('URGENT: Reduce angle exposure immediately');
            break;
          case 'mapControl':
            actions.push('URGENT: Reposition to secure map control');
            break;
        }
      }
    });

    return actions;
  }

  // Utility methods
  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private evaluateAngleCoverage(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    // Calculate angle between positions
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Normalize angle to 0-360 range
    const normalizedAngle = (angle + 360) % 360;

    // Calculate angle difference from optimal (90 degrees)
    const angleDiff = Math.abs(90 - Math.abs(normalizedAngle));

    // Score based on angle difference (higher score for angles closer to 90 degrees)
    const angleScore = Math.max(0, 1 - (angleDiff / 90));

    return angleScore;
  }

  private hasLineOfSight(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): boolean {
    // In a real implementation, this would use map geometry to check for obstacles
    // For now, we'll use a simple distance check
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Assume line of sight if within reasonable distance
    return distance < 1000;
  }

  private isExposedToAngle(position: { x: number; y: number; z: number }, angle: { x: number; y: number; z: number }): boolean {
    // Calculate angle to potential threat position
    const dx = angle.x - position.x;
    const dy = angle.y - position.y;
    const dz = angle.z - position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Consider exposed if within certain range and no cover
    return distance < 1000 && !this.hasCover(position, angle);
  }

  private hasCover(position: { x: number; y: number; z: number }, angle: { x: number; y: number; z: number }): boolean {
    // In a real implementation, this would check map geometry for cover objects
    // For now, we'll use common positions as potential cover points
    const mapData = this.mapData[this.currentMap];
    if (!mapData) return false;

    const coverPoints = [
      ...mapData.commonPositions.CT,
      ...mapData.commonPositions.T
    ];

    // Check if any cover point is between position and angle
    return coverPoints.some(cover => this.isCoverBetween(position, angle, cover));
  }

  private isCoverBetween(
    position: { x: number; y: number; z: number },
    angle: { x: number; y: number; z: number },
    cover: { x: number; y: number; z: number }
  ): boolean {
    // Calculate distances
    const d1 = this.calculateDistance(position, cover);
    const d2 = this.calculateDistance(cover, angle);
    const d3 = this.calculateDistance(position, angle);

    // Cover is between if it's closer to both points than they are to each other
    return d1 < d3 && d2 < d3;
  }

  private analyzePostPlantControl(
    playerData: AnalyzePositioningInput['playerData'],
    mapContext: AnalyzePositioningInput['mapContext'],
    teamState: AnalyzePositioningInput['teamState'],
    mapData: typeof this.mapData[string]
  ): number {
    let score = 0;
    const bombsite = mapContext.bombsite || 'A';

    // Get relevant positions for post-plant
    const postPlantPositions = mapData.postPlantPositions[bombsite];
    if (!postPlantPositions) return 0.5;

    // Check if player is in a good post-plant position
    const playerPos = playerData.position;
    const nearestPostPlant = postPlantPositions.reduce((nearest: number, pos: { x: number; y: number; z: number }) => {
      const distance = this.calculateDistance(playerPos, pos);
      return distance < nearest ? distance : nearest;
    }, Infinity);

    // Score based on position quality
    score += Math.max(0, 1 - nearestPostPlant / 500); // Higher score for closer positions

    // Check crossfire setup with teammates
    const hasCrossfire = teamState.teammatePositions.some(teammatePos => {
      const angleScore = this.evaluateAngleCoverage(playerPos, teammatePos);
      return angleScore > 0.7; // Good crossfire angle
    });
    if (hasCrossfire) score += 0.3;

    // Check line of sight to bomb
    const bombPos = mapData.bombsites[bombsite];
    if (this.hasLineOfSight(playerPos, bombPos)) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  private analyzePrePlantControl(
    playerData: AnalyzePositioningInput['playerData'],
    mapContext: AnalyzePositioningInput['mapContext'],
    teamState: AnalyzePositioningInput['teamState'],
    mapData: typeof this.mapData[string]
  ): number {
    let score = 0;
    const playerPos = playerData.position;

    // Check control of key map areas
    const keyAreas = mapData.keyAreas;
    const controlledAreas = keyAreas.filter((area: { x: number; y: number; z: number }) => 
      this.calculateDistance(playerPos, area) < 500
    ).length;

    score += controlledAreas / keyAreas.length * 0.4;

    // Check map presence distribution
    const teamPositions = [playerPos, ...teamState.teammatePositions];
    const spreadScore = this.evaluateTeamSpread(teamPositions);
    score += spreadScore * 0.3;

    // Check control of choke points
    const chokePoints = mapData.chokePoints;
    const chokeControl = chokePoints.filter((choke: { x: number; y: number; z: number }) =>
      this.hasLineOfSight(playerPos, choke)
    ).length;

    score += chokeControl / chokePoints.length * 0.3;

    return Math.min(score, 1);
  }

  private evaluateTeamSpread(positions: Array<{ x: number; y: number; z: number }>): number {
    if (positions.length < 2) return 0;

    // Calculate average position
    const avgPos = {
      x: positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length,
      y: positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length,
      z: positions.reduce((sum, pos) => sum + pos.z, 0) / positions.length
    };

    // Calculate average distance from center
    const avgDistance = positions.reduce((sum, pos) => {
      return sum + this.calculateDistance(pos, avgPos);
    }, 0) / positions.length;

    // Score based on spread (want some spread but not too much)
    const optimalSpread = 800; // Optimal average distance between players
    const spreadScore = 1 - Math.abs(avgDistance - optimalSpread) / optimalSpread;

    return Math.max(0, spreadScore);
  }

  private getPhaseWeights(mapContext: AnalyzePositioningInput['mapContext']): Record<string, number> {
    const { phase, bombPlanted } = mapContext;

    if (bombPlanted) {
      return {
        crossfire: 0.3,
        trade: 0.2,
        cover: 0.3,
        angle: 0.1,
        control: 0.1
      };
    }

    switch (phase) {
      case 'freezetime':
        return {
          crossfire: 0.1,
          trade: 0.1,
          cover: 0.2,
          angle: 0.3,
          control: 0.3
        };
      case 'live':
        return {
          crossfire: 0.25,
          trade: 0.25,
          cover: 0.2,
          angle: 0.15,
          control: 0.15
        };
      default:
        return {
          crossfire: 0.2,
          trade: 0.2,
          cover: 0.2,
          angle: 0.2,
          control: 0.2
        };
    }
  }

  private isNearSite(
    position: { x: number; y: number; z: number },
    mapData: typeof this.mapData[string]
  ): boolean {
    const siteDistanceThreshold = 500;
    return (
      this.calculateDistance(position, mapData.bombsites.A) < siteDistanceThreshold ||
      this.calculateDistance(position, mapData.bombsites.B) < siteDistanceThreshold
    );
  }

  private getLocationDescription(
    position: { x: number; y: number; z: number },
    mapName: string
  ): string {
    // Map-specific location names for de_dust2
    if (mapName === 'de_dust2') {
      // A site area
      if (position.x > 1000 && position.y > 2000) {
        if (position.x > 1300) return 'Long A';
        if (position.y > 2300) return 'A Site Corner';
        return 'A Site Default';
      }
      
      // B site area
      if (position.x < 300 && position.y < 1300) {
        if (position.x < 100) return 'B Tunnels';
        if (position.y < 1100) return 'B Site Default';
        return 'B Site Corner';
      }

      // Mid area
      if (position.x > 400 && position.x < 800 && position.y > 1400 && position.y < 1800) {
        return 'Mid';
      }

      // Short area
      if (position.x > 800 && position.x < 1000 && position.y > 1800 && position.y < 2000) {
        return 'Short A';
      }

      // Long area
      if (position.x > 1300 && position.y > 1800 && position.y < 2000) {
        return 'Long A';
      }
    }

    // Default to coordinate description if no specific location name is found
    return `(${Math.round(position.x)}, ${Math.round(position.y)})`;
  }
} 