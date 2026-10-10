const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = process.env.DATABASE_PATH || "./data/bot.sqlite";
const dir = path.dirname(dbPath);
if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  points_enabled INTEGER DEFAULT 0,
  points_per_message INTEGER DEFAULT 1,
  points_cooldown INTEGER DEFAULT 30,
  catch_enabled INTEGER DEFAULT 0,
  catch_channel_id TEXT,
  catch_interval INTEGER DEFAULT 10,
  catch_reward INTEGER DEFAULT 10,
  welcome_enabled INTEGER DEFAULT 0,
  welcome_channel_id TEXT,
  welcome_text TEXT DEFAULT 'Welcome {user} to {server}!',
  welcome_dm_enabled INTEGER DEFAULT 0,
  welcome_dm_text TEXT DEFAULT 'Welcome to {server}, {user}!',
  goodbye_enabled INTEGER DEFAULT 0,
  goodbye_channel_id TEXT,
  goodbye_text TEXT DEFAULT '{user} left {server}.',
  goodbye_dm_enabled INTEGER DEFAULT 0,
  goodbye_dm_text TEXT DEFAULT 'Thanks for being part of {server}.',
  logs_channel_id TEXT,
  antiraid_enabled INTEGER DEFAULT 0,
  antiraid_threshold INTEGER DEFAULT 8,
  antiraid_window INTEGER DEFAULT 10,
  antiraid_lockdown INTEGER DEFAULT 0,
  ticket_channel_id TEXT,
  ticket_category_id TEXT,
  ticket_staff_role_id TEXT
);

CREATE TABLE IF NOT EXISTS users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mmr INTEGER DEFAULT 0,
  messages INTEGER DEFAULT 0,
  last_message_at INTEGER DEFAULT 0,
  title TEXT DEFAULT 'Rookie',
  banner TEXT DEFAULT '',
  frame TEXT DEFAULT '',
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS cosmetics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  game TEXT DEFAULT 'Rocket League',
  reward INTEGER DEFAULT 10,
  enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS collections (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  cosmetic_id INTEGER NOT NULL,
  caught_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, cosmetic_id)
);

CREATE TABLE IF NOT EXISTS permissions (
  guild_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, feature)
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at INTEGER NOT NULL
);
`);

const defaults = db.prepare(`
INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)
`);

function ensureGuild(guildId) {
  defaults.run(guildId);
  return getGuild(guildId);
}

function getGuild(guildId) {
  ensureRow(guildId);
  return db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(guildId);
}

function ensureRow(guildId) {
  const row = db.prepare("SELECT guild_id FROM guild_settings WHERE guild_id = ?").get(guildId);
  if (!row) defaults.run(guildId);
}

function getUser(guildId, userId) {
  ensureUser(guildId, userId);
  return db.prepare("SELECT * FROM users WHERE guild_id = ? AND user_id = ?").get(guildId, userId);
}

function ensureUser(guildId, userId) {
  db.prepare("INSERT OR IGNORE INTO users (guild_id, user_id) VALUES (?, ?)").run(guildId, userId);
}

function setUserFields(guildId, userId, fields) {
  ensureUser(guildId, userId);
  const keys = Object.keys(fields);
  if (!keys.length) return getUser(guildId, userId);
  const sql = `UPDATE users SET ${keys.map(k => `${k} = @${k}`).join(", ")} WHERE guild_id = @guildId AND user_id = @userId`;
  db.prepare(sql).run({ guildId, userId, ...fields });
  return getUser(guildId, userId);
}

function addMMR(guildId, userId, amount) {
  ensureUser(guildId, userId);
  db.prepare("UPDATE users SET mmr = MAX(0, MIN(2200, mmr + ?)) WHERE guild_id = ? AND user_id = ?")
    .run(amount, guildId, userId);
  return getUser(guildId, userId);
}

function setMMR(guildId, userId, mmr) {
  ensureUser(guildId, userId);
  db.prepare("UPDATE users SET mmr = MAX(0, MIN(2200, ?)) WHERE guild_id = ? AND user_id = ?")
    .run(mmr, guildId, userId);
  return getUser(guildId, userId);
}

module.exports = {
  db, ensureGuild, getGuild, getUser, ensureUser, setUserFields, addMMR, setMMR
};
