require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { commands } = require("./commands");

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error("Faltan DISCORD_TOKEN o CLIENT_ID.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  if (process.env.GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log("Comandos registrados en el servidor de prueba.");
  } else {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("Comandos registrados globalmente.");
  }
})().catch(console.error);
