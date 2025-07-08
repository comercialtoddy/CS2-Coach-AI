/**
 * Game State Integration (GSI) Type Definitions
 */

export interface GSIDataModel {
  allplayers?: Record<string, {
    team: string;
    state?: {
      money?: number;
      equip_value?: number;
    };
    observer_slot?: number;
    weapons?: Record<string, {
      name: string;
    }>;
    position?: string;
  }>;
  map?: {
    round?: number;
    round_wins?: string[];
  };
} 