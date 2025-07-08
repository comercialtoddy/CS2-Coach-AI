import sqlite3 from "sqlite3";
import { getDatabasePath } from "../helpers/index.js";

// Initialize the SQLite database
const dbPath = getDatabasePath();
export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the database.");
  db.run(
    `CREATE TABLE IF NOT EXISTS coaches(
      steamid TEXT PRIMARY KEY
    )`,
    (err) => {
      if (err) {
        console.error("Error creating coaches table:", err.message);
      }
    },
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS players(
      _id TEXT PRIMARY KEY,
      firstName TEXT,
      lastName TEXT,
      username TEXT,
      avatar TEXT,
      country TEXT,
      steamid TEXT,
      team TEXT,
      extra TEXT
    )`,
    (err) => {
      if (err) {
        console.error(err.message);
      }
    },
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS teams(
      _id TEXT PRIMARY KEY,
      name TEXT,
      country TEXT,
      shortName TEXT,
      logo TEXT,
      extra TEXT
    )`,
    (err) => {
      if (err) {
        console.error(err.message);
      }
    },
  );
});

db.run(
  `CREATE TABLE IF NOT EXISTS matches(
    id TEXT PRIMARY KEY,
    current BOOLEAN,
    left_id TEXT,
    left_wins INTEGER,
    right_id TEXT,
    right_wins INTEGER,
    matchType TEXT,
    vetos TEXT
  )`,
  (err) => {
    if (err) {
      console.error(err.message);
    }
  },
);

db.run(
  `CREATE TABLE IF NOT EXISTS settings(
    language TEXT DEFAULT 'en',
    layout TEXT DEFAULT 'horizontal',
    autoSwitch BOOLEAN DEFAULT 0,
    theme TEXT DEFAULT 'dark'
  )`,
  (err) => {
    if (err) {
      console.error(err.message);
    } else {
      // Check if the settings table is empty
      db.get(
        `SELECT COUNT(*) as count FROM settings`,
        (err, row: { count: number }) => {
          if (err) {
            console.error(err.message);
          } else if (row.count === 0) {
            // Insert default values if the table is empty
            db.run(
              `INSERT INTO settings (language, layout, autoSwitch, theme)
             VALUES ('en', 'horizontal', 0, 'dark')`,
              (err) => {
                if (err) {
                  console.error(err.message);
                } else {
                  console.log("Inserted default settings.");
                }
              },
            );
          }
        },
      );
    }
  },
);

db.run(
  `CREATE TABLE IF NOT EXISTS generated_tasks(
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    task_type_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    parameters TEXT NOT NULL,
    completion_criteria TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    expected_reward INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    expires_at TEXT,
    progress TEXT NOT NULL,
    context TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(steamid)
  )`,
  (err) => {
    if (err) {
      console.error("Error creating generated_tasks table:", err.message);
    } else {
      console.log("Generated tasks table ready.");
    }
  },
);

export default db;
