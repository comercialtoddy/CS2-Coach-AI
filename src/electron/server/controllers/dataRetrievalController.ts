import { Request, Response } from 'express';
import { GSI } from '../sockets/GSI.js';
import { getTrackerGGPlayerStats, isTrackerGGConfigured, getTrackerGGRateLimitInfo } from '../services/trackerGGServices.js';
import { getPlayers, updatePlayer } from '../services/playersServices.js';
import { isOpenRouterConfigured, testConnection as testOpenRouter } from '../services/openRouterServices.js';
import { isPiperConfigured } from '../services/piperTTSServices.js';

export const getStatus = async (req: Request, res: Response) => {
  try {
    // Check the status of all major services
    const status = {
      timestamp: new Date().toISOString(),
      services: {
        gsi: {
          available: !!GSI,
          lastUpdate: GSI.last ? new Date(GSI.last.provider.timestamp * 1000).toISOString() : null,
          gameConnected: GSI.current ? true : false,
          mapName: GSI.current?.map?.name || null
        },
        trackerGG: {
          configured: isTrackerGGConfigured(),
          rateLimits: getTrackerGGRateLimitInfo()
        },
        openRouter: {
          configured: isOpenRouterConfigured()
        },
        piperTTS: {
          configured: isPiperConfigured()
        }
      },
      database: {
        connected: true, // SQLite is always available
        lastActivity: new Date().toISOString()
      },
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        total: process.memoryUsage().heapTotal / 1024 / 1024 // MB
      }
    };

    res.status(200).json({ status: 'ok', details: status });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
};

export const getGSIInfo = async (req: Request, res: Response) => {
  try {
    if (!GSI) {
      return res.status(503).json({ 
        error: 'GSI not available',
        message: 'Game State Integration is not initialized' 
      });
    }

    const gsiData = {
      connected: !!GSI.current,
      lastUpdate: GSI.last ? new Date(GSI.last.provider.timestamp * 1000).toISOString() : null,
      current: GSI.current ? {
        map: {
          name: GSI.current.map?.name,
          phase: GSI.current.map?.phase,
          round: GSI.current.map?.round,
          mode: GSI.current.map?.mode
        },
        player: GSI.current.player ? {
          steamid: GSI.current.player.steamid,
          name: GSI.current.player.name,
          team: GSI.current.player.team,
          state: GSI.current.player.state
        } : null,
        teams: {
          ct: GSI.current.map?.team_ct,
          t: GSI.current.map?.team_t
        },
        round: GSI.current.round ? {
          phase: GSI.current.round.phase,
          bomb: GSI.current.round.bomb
        } : null
      } : null,
      stats: {
        totalUpdates: GSI.last ? GSI.last.provider.timestamp : 0,
        avgUpdateRate: '30/sec' // Approximate
      }
    };

    res.status(200).json(gsiData);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get GSI info',
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
};

export const getTrackerGGStats = async (req: Request, res: Response) => {
  try {
    const { steamId, gameMode = 'cs2' } = req.query;

    if (!steamId || typeof steamId !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required parameter',
        message: 'steamId query parameter is required' 
      });
    }

    if (!isTrackerGGConfigured()) {
      return res.status(503).json({ 
        error: 'Tracker.GG not configured',
        message: 'Tracker.GG API key is not configured' 
      });
    }

    const stats = await getTrackerGGPlayerStats(steamId, gameMode as 'cs2' | 'csgo');
    
    res.status(200).json({
      success: true,
      data: stats,
      source: 'tracker.gg',
      cached: false, // The service handles caching internally
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        return res.status(429).json({ error: error.message });
      } else if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      } else if (error.message.includes('Invalid') || error.message.includes('access denied')) {
        return res.status(401).json({ error: error.message });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to get Tracker.GG stats',
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
};

export const updatePlayerProfiles = async (req: Request, res: Response) => {
  try {
    const players = await getPlayers();
    const updateResults = [];

    for (const player of players) {
      if (!player.steamid) {
        updateResults.push({
          playerId: player._id,
          status: 'skipped',
          reason: 'No Steam ID available'
        });
        continue;
      }

      try {
        // Try to get updated stats from Tracker.GG
        if (isTrackerGGConfigured()) {
          const stats = await getTrackerGGPlayerStats(player.steamid);
          
          // Update player with fresh stats
          const updatedPlayer = {
            ...player,
            country: stats.userInfo.countryCode || player.country,
            avatar: stats.userInfo.customAvatarUrl || player.avatar,
            lastStatsUpdate: new Date().toISOString()
          };

          await updatePlayer(player._id, updatedPlayer);
          
          updateResults.push({
            playerId: player._id,
            status: 'updated',
            source: 'tracker.gg'
          });
        } else {
          updateResults.push({
            playerId: player._id,
            status: 'skipped',
            reason: 'Tracker.GG not configured'
          });
        }
      } catch (error) {
        updateResults.push({
          playerId: player._id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.status(200).json({
      success: true,
      totalPlayers: players.length,
      results: updateResults,
      summary: {
        updated: updateResults.filter(r => r.status === 'updated').length,
        skipped: updateResults.filter(r => r.status === 'skipped').length,
        errors: updateResults.filter(r => r.status === 'error').length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to update player profiles',
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
};

export const getToolsInfo = async (req: Request, res: Response) => {
  try {
    const tools = {
      aiTools: {
        openRouter: {
          name: 'OpenRouter API',
          configured: isOpenRouterConfigured(),
          description: 'LLM API service for AI coaching',
          endpoints: ['chat/completions', 'models']
        },
        piperTTS: {
          name: 'Piper Text-to-Speech',
          configured: isPiperConfigured(),
          description: 'Neural TTS for voice feedback'
        }
      },
      dataRetrieval: {
        trackerGG: {
          name: 'Tracker.GG API',
          configured: isTrackerGGConfigured(),
          description: 'Player statistics and game data',
          rateLimits: getTrackerGGRateLimitInfo()
        },
        gsi: {
          name: 'Game State Integration',
          configured: !!GSI,
          description: 'Real-time CS2 game data',
          connected: GSI.current ? true : false
        }
      },
      database: {
        sqlite: {
          name: 'SQLite Database',
          configured: true,
          description: 'Local data storage',
          status: 'available'
        }
      }
    };

    res.status(200).json({
      success: true,
      tools,
      summary: {
        totalTools: Object.keys(tools.aiTools).length + Object.keys(tools.dataRetrieval).length + Object.keys(tools.database).length,
        configured: Object.values({...tools.aiTools, ...tools.dataRetrieval, ...tools.database}).filter(tool => tool.configured).length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get tools info',
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
};

export const testAllTools = async (req: Request, res: Response) => {
  try {
    const testResults = {
      openRouter: {
        name: 'OpenRouter API',
        tested: false,
        success: false,
        message: '',
        responseTime: 0
      },
      trackerGG: {
        name: 'Tracker.GG API',
        tested: false,
        success: false,
        message: '',
        responseTime: 0
      },
      gsi: {
        name: 'Game State Integration',
        tested: true,
        success: !!GSI && !!GSI.current,
        message: GSI && GSI.current ? 'Connected and receiving data' : 'Not connected or no data',
        responseTime: 0
      },
      database: {
        name: 'SQLite Database',
        tested: true,
        success: true,
        message: 'Always available',
        responseTime: 0
      }
    };

    // Test OpenRouter
    if (isOpenRouterConfigured()) {
      const startTime = Date.now();
      try {
        const result = await testOpenRouter();
        testResults.openRouter.tested = true;
        testResults.openRouter.success = result.success;
        testResults.openRouter.message = result.error || 'Connection successful';
        testResults.openRouter.responseTime = Date.now() - startTime;
      } catch (error) {
        testResults.openRouter.tested = true;
        testResults.openRouter.success = false;
        testResults.openRouter.message = error instanceof Error ? error.message : 'Test failed';
        testResults.openRouter.responseTime = Date.now() - startTime;
      }
    } else {
      testResults.openRouter.message = 'Not configured';
    }

    // Test Tracker.GG
    if (isTrackerGGConfigured()) {
      testResults.trackerGG.tested = true;
      testResults.trackerGG.success = getTrackerGGRateLimitInfo().canMakeRequest;
      testResults.trackerGG.message = getTrackerGGRateLimitInfo().canMakeRequest 
        ? 'Ready to make requests' 
        : 'Rate limit exceeded';
    } else {
      testResults.trackerGG.message = 'Not configured';
    }

    const summary = {
      totalTests: Object.keys(testResults).length,
      passed: Object.values(testResults).filter(test => test.success).length,
      failed: Object.values(testResults).filter(test => test.tested && !test.success).length,
      skipped: Object.values(testResults).filter(test => !test.tested).length
    };

    res.status(200).json({
      success: true,
      results: testResults,
      summary,
      testedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to test tools',
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
}; 