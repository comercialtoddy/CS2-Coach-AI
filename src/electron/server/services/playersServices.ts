import { randomUUID } from "crypto";
import db from "../../database/database.js";

export const getPlayers = (): Promise<Player[]> => {
  const sql = `SELECT * FROM players`;
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Error getting teams: ", err.message);
        reject(err);
      } else {
        resolve(rows as Player[]);
      }
    });
  });
};

export const createPlayer = (player: Partial<Player>) => {
  if (!player.steamid) {
    return Promise.reject(new Error("steamid is required to create a player"));
  }

  const playerData: Player = {
    _id: player._id || randomUUID(),
    steamid: player.steamid,
    username: player.username || 'New Player',
    firstName: player.firstName || '',
    lastName: player.lastName || '',
    avatar: player.avatar || '',
    country: player.country || '',
    team: player.team || '',
    extra: player.extra || {},
  };
  
  const sql = `
  INSERT INTO players (_id, firstName, lastName, username, avatar, country, steamid, team, extra)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
  return new Promise((resolve, reject) => {
    db.run(
      sql,
      [
        playerData._id,
        playerData.firstName,
        playerData.lastName,
        playerData.username,
        playerData.avatar,
        playerData.country,
        playerData.steamid,
        playerData.team,
        JSON.stringify(playerData.extra),
      ],
      function (err) {
        if (err) {
          console.error("Error inserting player:", err.message);
          reject(err);
        } else {
          console.log(
            `Player ${playerData.username} created with ID ${playerData._id}`,
          );
          resolve(playerData);
        }
      },
    );
  });
};

export const deletePlayer = (id: string) => {
  const sql = `DELETE FROM players WHERE _id = ?`;
  return new Promise((resolve, reject) => {
    db.run(sql, [id], function (err) {
      if (err) {
        console.error("Error deleting player :", err.message);
        reject(err);
      } else {
        console.log(`Player deleted`);
        resolve("Player deleted");
      }
    });
  });
};

export const updatePlayer = (id: string, player: Partial<Player>) => {
  const fields = Object.keys(player);
  const values = Object.values(player);

  if (fields.length === 0) {
    return Promise.resolve("No fields to update");
  }

  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const sql = `UPDATE players SET ${setClause} WHERE _id = ?`;

  return new Promise((resolve, reject) => {
    db.run(
      sql,
      [...values.map(v => typeof v === 'object' ? JSON.stringify(v) : v), id],
      function (err) {
        if (err) {
          console.error("Error updating player :", err.message);
          reject(err);
        } else {
          console.log(`Player updated with id: ${id}`);
          resolve(`Player updated with id: ${id}`);
        }
      },
    );
  });
};

export const getPlayerBySteamId = (steamid: string) => {
  const sql = `SELECT * FROM players WHERE steamid = ?`;
  return new Promise((resolve, reject) => {
    db.get(sql, [steamid], function (err, row) {
      if (err) {
        console.error("Error finding finding:", err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};
