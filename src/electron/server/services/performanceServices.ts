import type { PerformanceStats, MapStats, WeaponStats, MatchStats, Settings } from '../../../types/performance.js';
import { db } from '../../database/database.js';
import { promisify } from 'util';

// Promisify database methods for async/await usage
const dbGet = promisify(db.get.bind(db)) as (sql: string, params?: any[]) => Promise<any>;
const dbAll = promisify(db.all.bind(db)) as (sql: string, params?: any[]) => Promise<any[]>;
const dbRun = promisify(db.run.bind(db)) as (sql: string, params?: any[]) => Promise<any>;

class PerformanceServices {
  // Get performance overview
  async getOverview(): Promise<PerformanceStats> {
    try {
      // Get overall performance metrics from database
      const statsQuery = `
        SELECT 
          COUNT(*) as totalMatches,
          AVG(CASE WHEN winner = 'player' THEN 1 ELSE 0 END) as winRate,
          AVG(kills) as avgKills,
          AVG(deaths) as avgDeaths,
          AVG(assists) as avgAssists,
          AVG(damage) as avgDamage,
          AVG(CASE WHEN deaths > 0 THEN CAST(kills as FLOAT) / deaths ELSE kills END) as kdRatio,
          AVG(headshots) as avgHeadshots,
          AVG(CASE WHEN kills > 0 THEN CAST(headshots as FLOAT) / kills * 100 ELSE 0 END) as headshotPercentage
        FROM performance_stats 
        WHERE created_at > datetime('now', '-30 days')
      `;

      const stats = await dbGet(statsQuery);
      
      // Get recent matches
      const recentMatchesQuery = `
        SELECT 
          match_id,
          map_name,
          kills,
          deaths,
          assists,
          score,
          result,
          created_at
        FROM performance_stats 
        ORDER BY created_at DESC 
        LIMIT 5
      `;

      const recentMatches = await dbAll(recentMatchesQuery);

      return {
        winRate: stats?.winRate || 0,
        kdRatio: stats?.kdRatio || 0,
        adr: stats?.avgDamage || 0, // Average Damage per Round
        headshotPercentage: stats?.headshotPercentage || 0,
        recentMatches: recentMatches || []
      };
    } catch (error) {
      console.error('Error getting performance overview:', error);
      // Return default values if database query fails
      return {
        winRate: 0,
        kdRatio: 0,
        adr: 0,
        headshotPercentage: 0,
        recentMatches: []
      };
    }
  }

  // Get map stats
  async getMapStats(map?: string): Promise<MapStats[]> {
    try {
      let query = `
        SELECT 
          map_name as map,
          COUNT(*) as totalMatches,
          AVG(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as winRate,
          AVG(CASE WHEN side = 'T' AND result = 'win' THEN 1 ELSE 0 END) as tSideWinRate,
          AVG(CASE WHEN side = 'CT' AND result = 'win' THEN 1 ELSE 0 END) as ctSideWinRate,
          AVG(entry_frags) as entrySuccessRate
        FROM performance_stats 
        WHERE 1=1
      `;
      
      const params: any[] = [];
      if (map) {
        query += ' AND map_name = ?';
        params.push(map);
      }
      
      query += ' GROUP BY map_name ORDER BY totalMatches DESC';

      const mapStats = await dbAll(query, params);

      return mapStats.map((stat: any) => ({
        map: stat.map,
        winRate: stat.winRate || 0,
        tSideWinRate: stat.tSideWinRate || 0,
        ctSideWinRate: stat.ctSideWinRate || 0,
        entrySuccessRate: stat.entrySuccessRate || 0,
        commonPositions: [], // Could be implemented with more detailed tracking
        commonAngles: [] // Could be implemented with more detailed tracking
      }));
    } catch (error) {
      console.error('Error getting map stats:', error);
      // Return default for specified map or empty array
      if (map) {
        return [{
          map,
          winRate: 0,
          tSideWinRate: 0,
          ctSideWinRate: 0,
          entrySuccessRate: 0,
          commonPositions: [],
          commonAngles: []
        }];
      }
      return [];
    }
  }

  // Get weapon stats
  async getWeaponStats(type?: string): Promise<WeaponStats[]> {
    try {
      let query = `
        SELECT 
          weapon_name as name,
          weapon_type as type,
          SUM(weapon_kills) as kills,
          AVG(weapon_accuracy) as accuracy,
          SUM(weapon_headshots) as headshots,
          SUM(weapon_damage) as damage
        FROM weapon_stats 
        WHERE 1=1
      `;
      
      const params: any[] = [];
      if (type) {
        query += ' AND weapon_type = ?';
        params.push(type);
      }
      
      query += ' GROUP BY weapon_name, weapon_type ORDER BY kills DESC LIMIT 20';

      const weaponStats = await dbAll(query, params);

      return weaponStats.map((stat: any) => ({
        name: stat.name,
        type: stat.type,
        kills: stat.kills || 0,
        accuracy: stat.accuracy || 0,
        headshots: stat.headshots || 0,
        damage: stat.damage || 0
      }));
    } catch (error) {
      console.error('Error getting weapon stats:', error);
      // Return default weapon if type specified
      if (type) {
        const validType = this.validateWeaponType(type);
        return [{
          name: 'AK-47',
          type: validType,
          kills: 0,
          accuracy: 0,
          headshots: 0,
          damage: 0
        }];
      }
      return [];
    }
  }

  // Get match history
  async getMatchHistory(
    page: number = 1,
    filters?: {
      map?: string;
      result?: 'win' | 'loss';
    }
  ): Promise<{
    matches: MatchStats[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const limit = 10;
      const offset = (page - 1) * limit;

      // Build WHERE clause based on filters
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      
      if (filters?.map) {
        whereClause += ' AND map_name = ?';
        params.push(filters.map);
      }
      
      if (filters?.result) {
        whereClause += ' AND result = ?';
        params.push(filters.result);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM performance_stats ${whereClause}`;
      const countResult = await dbGet(countQuery, params);
      const total = countResult?.total || 0;

      // Get matches
      const matchesQuery = `
        SELECT 
          match_id,
          map_name,
          kills,
          deaths,
          assists,
          score,
          result,
          duration,
          mvp_count,
          created_at
        FROM performance_stats 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      const matches = await dbAll(matchesQuery, [...params, limit, offset]);

      return {
        matches: matches || [],
        total,
        hasMore: total > offset + limit
      };
    } catch (error) {
      console.error('Error getting match history:', error);
      return {
        matches: [],
        total: 0,
        hasMore: false
      };
    }
  }

  // Get performance settings
  async getSettings(): Promise<Settings> {
    try {
      const settingsQuery = `
        SELECT 
          voice_model,
          voice_volume,
          ai_model,
          ai_response_style,
          show_win_loss_streak,
          show_performance_trends,
          show_match_details,
          performance_milestones,
          match_analysis,
          personal_records
        FROM performance_settings 
        ORDER BY updated_at DESC 
        LIMIT 1
      `;

      const settings = await dbGet(settingsQuery);

      if (settings) {
        return {
          voice: {
            model: settings.voice_model || 'default',
            volume: settings.voice_volume || 0.8
          },
          ai: {
            model: settings.ai_model || 'default',
            responseStyle: settings.ai_response_style || 'concise'
          },
          display: {
            showWinLossStreak: Boolean(settings.show_win_loss_streak),
            showPerformanceTrends: Boolean(settings.show_performance_trends),
            showMatchDetails: Boolean(settings.show_match_details)
          },
          notifications: {
            performanceMilestones: Boolean(settings.performance_milestones),
            matchAnalysis: Boolean(settings.match_analysis),
            personalRecords: Boolean(settings.personal_records)
          }
        };
      }

      // Return defaults if no settings found
      return this.getDefaultSettings();
    } catch (error) {
      console.error('Error getting performance settings:', error);
      return this.getDefaultSettings();
    }
  }

  // Update performance settings
  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    try {
      // First get current settings
      const currentSettings = await this.getSettings();

      // Merge with new settings
      const updatedSettings = {
        voice: { ...currentSettings.voice, ...settings.voice },
        ai: { ...currentSettings.ai, ...settings.ai },
        display: { ...currentSettings.display, ...settings.display },
        notifications: { ...currentSettings.notifications, ...settings.notifications }
      };

      // Update in database
      const updateQuery = `
        INSERT OR REPLACE INTO performance_settings (
          voice_model,
          voice_volume,
          ai_model,
          ai_response_style,
          show_win_loss_streak,
          show_performance_trends,
          show_match_details,
          performance_milestones,
          match_analysis,
          personal_records,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;

      await dbRun(updateQuery, [
        updatedSettings.voice.model,
        updatedSettings.voice.volume,
        updatedSettings.ai.model,
        updatedSettings.ai.responseStyle,
        updatedSettings.display.showWinLossStreak ? 1 : 0,
        updatedSettings.display.showPerformanceTrends ? 1 : 0,
        updatedSettings.display.showMatchDetails ? 1 : 0,
        updatedSettings.notifications.performanceMilestones ? 1 : 0,
        updatedSettings.notifications.matchAnalysis ? 1 : 0,
        updatedSettings.notifications.personalRecords ? 1 : 0
      ]);

      return updatedSettings;
    } catch (error) {
      console.error('Error updating performance settings:', error);
      // Return current settings if update fails
      return await this.getSettings();
    }
  }

  // Helper method to validate weapon type
  private validateWeaponType(type: string): 'Rifle' | 'SMG' | 'Pistol' | 'Sniper' | 'Heavy' {
    const validTypes: ('Rifle' | 'SMG' | 'Pistol' | 'Sniper' | 'Heavy')[] = ['Rifle', 'SMG', 'Pistol', 'Sniper', 'Heavy'];
    return validTypes.includes(type as any) ? type as any : 'Rifle';
  }

  // Helper method for default settings
  private getDefaultSettings(): Settings {
    return {
      voice: {
        model: 'default',
        volume: 0.8
      },
      ai: {
        model: 'default',
        responseStyle: 'concise'
      },
      display: {
        showWinLossStreak: true,
        showPerformanceTrends: true,
        showMatchDetails: true
      },
      notifications: {
        performanceMilestones: true,
        matchAnalysis: true,
        personalRecords: true
      }
    };
  }

  // Initialize database tables for performance tracking
  async initializePerformanceTables(): Promise<void> {
    try {
      // Create performance_stats table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS performance_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id TEXT,
          player_id TEXT,
          map_name TEXT,
          side TEXT,
          kills INTEGER,
          deaths INTEGER,
          assists INTEGER,
          damage INTEGER,
          headshots INTEGER,
          entry_frags INTEGER,
          score INTEGER,
          result TEXT,
          duration INTEGER,
          mvp_count INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create weapon_stats table  
      await dbRun(`
        CREATE TABLE IF NOT EXISTS weapon_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id TEXT,
          player_id TEXT,
          weapon_name TEXT,
          weapon_type TEXT,
          weapon_kills INTEGER,
          weapon_headshots INTEGER,
          weapon_damage INTEGER,
          weapon_accuracy REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create performance_settings table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS performance_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voice_model TEXT,
          voice_volume REAL,
          ai_model TEXT,
          ai_response_style TEXT,
          show_win_loss_streak BOOLEAN,
          show_performance_trends BOOLEAN,
          show_match_details BOOLEAN,
          performance_milestones BOOLEAN,
          match_analysis BOOLEAN,
          personal_records BOOLEAN,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Performance tables initialized successfully');
    } catch (error) {
      console.error('Error initializing performance tables:', error);
    }
  }
}

export const performanceServices = new PerformanceServices();