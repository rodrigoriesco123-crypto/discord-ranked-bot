require("dotenv").config();
const {
  Client, GatewayIntentBits, Partials, Events,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, AuditLogEvent
} = require("discord.js");
const { commands, execute } = require("./commands");
const { REST, Routes } = require("discord.js");
const { ensureGuild, getGuild, getUser, setUserFields, addMMR, db } = require("./db");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.GuildMember, Partials.Channel, Partials.User]
});

const joinBuckets = new Map();
const messageBuckets = new Map();
const activeLockdowns = new Set();

function now() { return Date.now(); }

async function log(guild, title, description) {
  const g = getGuild(guild.id);
  if (!g.logs_channel_id) return;
  const channel = guild.channels.cache.get(g.logs_channel_id);
  if (!channel?.isTextBased()) return;
  channel.send({ embeds:[new EmbedBuilder().setTitle(title).setDescription(description).setTimestamp()] }).catch(()=>{});
}

async function lockGuild(guild, seconds = 60) {
  if (activeLockdowns.has(guild.id)) return;
  activeLockdowns.add(guild.id);

  const everyone = guild.roles.everyone;
  const changed = [];
  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased() || channel.isThread()) continue;
    const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
    const restore = {
      SendMessages: overwrite?.allow.has(PermissionFlagsBits.SendMessages)
        ? true
        : overwrite?.deny.has(PermissionFlagsBits.SendMessages)
          ? false
          : null,
      AddReactions: overwrite?.allow.has(PermissionFlagsBits.AddReactions)
        ? true
        : overwrite?.deny.has(PermissionFlagsBits.AddReactions)
          ? false
          : null
    };
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages:false, AddReactions:false });
      changed.push({ channelId: channel.id, restore });
    } catch {}
  }
  await log(guild, "🚨 ANTI-RAID LOCKDOWN", `El servidor entró en lockdown durante aproximadamente ${seconds}s.`);
  setTimeout(async () => {
    try {
      for (const { channelId, restore } of changed) {
        const ch = guild.channels.cache.get(channelId);
        if (!ch) continue;
        try { await ch.permissionOverwrites.edit(everyone, restore); } catch {}
      }
      await log(guild, "🔓 LOCKDOWN TERMINADO", "Se restauraron los permisos públicos.");
    } finally {
      activeLockdowns.delete(guild.id);
    }
  }, Math.max(0, seconds) * 1000);
}

async function sendCatch(guild) {
  const g = getGuild(guild.id);
  if (!g.catch_enabled || !g.catch_channel_id) return;
  const channel = guild.channels.cache.get(g.catch_channel_id);
  if (!channel?.isTextBased()) return;
  const items = db.prepare("SELECT * FROM cosmetics WHERE guild_id=? AND enabled=1").all(guild.id);
  if (!items.length) return;
  const item = items[Math.floor(Math.random() * items.length)];
  const embed = new EmbedBuilder()
    .setTitle("🎯 CATCH ME!")
    .setDescription(`¿Cuál es el nombre de este cosmético de **${item.game}**?\nPulsa **Catch me!** para responder.`)
    .setImage(item.image_url)
    .setFooter({ text: "Solo una respuesta por usuario para este reto." });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`catch:answer:${item.id}`).setLabel("Catch me!").setStyle(ButtonStyle.Danger)
  );
  await channel.send({ embeds:[embed], components:[row] });
}

client.once(Events.ClientReady, async c => {
  console.log(`Conectado como ${c.user.tag}`);
  try {
    const rest = new REST({version:"10"}).setToken(process.env.DISCORD_TOKEN);
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(c.user.id, process.env.GUILD_ID), {body:commands});
      console.log("Slash commands registrados en el servidor de prueba.");
    } else if (process.env.REGISTER_GLOBAL === "true") {
      await rest.put(Routes.applicationCommands(c.user.id), {body:commands});
      console.log("Slash commands globales registrados.");
    }
  } catch (e) { console.error("Error registrando comandos:", e); }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) return execute(interaction, client);

    if (interaction.isButton() && interaction.customId === "ticket:create") {
      const g = getGuild(interaction.guild.id);
      const existing = db.prepare("SELECT channel_id FROM tickets WHERE guild_id=? AND user_id=? AND status='open'")
        .get(interaction.guild.id, interaction.user.id);
      if (existing) return interaction.reply({content:`Ya tienes un ticket abierto: <#${existing.channel_id}>`,ephemeral:true});

      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory] }
      ];
      if (g.ticket_staff_role_id) overwrites.push({id:g.ticket_staff_role_id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
      const channel = await interaction.guild.channels.create({
        name:`ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,80),
        type:ChannelType.GuildText,
        parent:g.ticket_category_id || undefined,
        permissionOverwrites:overwrites
      });
      db.prepare("INSERT INTO tickets(guild_id,channel_id,user_id,created_at) VALUES(?,?,?,?)")
        .run(interaction.guild.id,channel.id,interaction.user.id,now());
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket:close").setLabel("Cerrar ticket").setStyle(ButtonStyle.Secondary)
      );
      await channel.send({content:`${interaction.user} bienvenido a tu ticket.`,embeds:[new EmbedBuilder().setTitle("🎫 Ticket").setDescription("Explica tu problema. El staff podrá ayudarte.")],components:[row]});
      return interaction.reply({content:`Ticket creado: ${channel}`,ephemeral:true});
    }

    if (interaction.isButton() && interaction.customId === "ticket:close") {
      const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id=? AND status='open'").get(interaction.channel.id);
      if (!ticket) return interaction.reply({content:"Este no es un ticket abierto.",ephemeral:true});
      const g = getGuild(interaction.guild.id);
      const allowed = interaction.user.id === ticket.user_id || interaction.guild.ownerId === interaction.user.id || (g.ticket_staff_role_id && interaction.member.roles.cache.has(g.ticket_staff_role_id));
      if (!allowed) return interaction.reply({content:"No tienes permiso para cerrar este ticket.",ephemeral:true});
      db.prepare("UPDATE tickets SET status='closed' WHERE channel_id=?").run(interaction.channel.id);
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone,{ViewChannel:false}).catch(()=>{});
      return interaction.reply("Ticket cerrado.");
    }

    if (interaction.isButton() && interaction.customId.startsWith("catch:answer:")) {
      const id = Number(interaction.customId.split(":")[2]);
      const item = db.prepare("SELECT * FROM cosmetics WHERE guild_id=? AND id=?").get(interaction.guild.id,id);
      if (!item) return interaction.reply({content:"Este reto ya no está disponible.",ephemeral:true});
      const modal = new (require("discord.js").ModalBuilder)().setCustomId(`catchmodal:${id}`).setTitle("Catch Me!");
      const input = new (require("discord.js").TextInputBuilder)().setCustomId("answer").setLabel("Nombre del cosmético").setStyle(require("discord.js").TextInputStyle.Short).setRequired(true).setMaxLength(100);
      modal.addComponents(new (require("discord.js").ActionRowBuilder)().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("catchmodal:")) {
      const id = Number(interaction.customId.split(":")[1]);
      const item = db.prepare("SELECT * FROM cosmetics WHERE guild_id=? AND id=?").get(interaction.guild.id,id);
      if (!item) return interaction.reply({content:"Este reto ya no está disponible.",ephemeral:true});
      const answer = interaction.fields.getTextInputValue("answer").trim().toLowerCase();
      if (answer !== item.name.trim().toLowerCase()) return interaction.reply(`${interaction.user} Wrong name!`);
      const exists = db.prepare("SELECT 1 FROM collections WHERE guild_id=? AND user_id=? AND cosmetic_id=?").get(interaction.guild.id,interaction.user.id,id);
      if (!exists) {
        db.prepare("INSERT INTO collections(guild_id,user_id,cosmetic_id,caught_at) VALUES(?,?,?,?)").run(interaction.guild.id,interaction.user.id,id,now());
        addMMR(interaction.guild.id,interaction.user.id,item.reward);
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("profile:self").setLabel("Ver mi perfil").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("collection:self").setLabel("Ver mi colección").setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({content:`${interaction.user} You caught **${item.name}**! +${item.reward} MMR`,components:[row]});
    }

    if (interaction.isButton() && interaction.customId === "profile:self") {
      const { AttachmentBuilder } = require("discord.js");
      const { makeProfileCard } = require("./profile");
      const data = getUser(interaction.guild.id,interaction.user.id);
      const card = await makeProfileCard({user:interaction.user,data});
      return interaction.reply({files:[new AttachmentBuilder(card,{name:"profile.png"})],ephemeral:true});
    }

    if (interaction.isButton() && interaction.customId === "collection:self") {
      const rows = db.prepare(`SELECT c.name,c.game FROM collections col JOIN cosmetics c ON c.id=col.cosmetic_id WHERE col.guild_id=? AND col.user_id=? ORDER BY col.caught_at DESC`)
        .all(interaction.guild.id,interaction.user.id);
      return interaction.reply({content: rows.length ? rows.map(x=>`• **${x.name}** — ${x.game}`).join("\n") : "Tu colección está vacía.",ephemeral:true});
    }
  } catch (e) {
    console.error("interaction error",e);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) interaction.reply({content:"Ocurrió un error.",ephemeral:true}).catch(()=>{});
  }
});

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;
  const g = getGuild(message.guild.id);
  const u = getUser(message.guild.id,message.author.id);

  if (g.points_enabled && g.points_per_message > 0) {
    const t = now();
    if (t - u.last_message_at >= g.points_cooldown * 1000) {
      addMMR(message.guild.id,message.author.id,g.points_per_message);
      setUserFields(message.guild.id,message.author.id,{messages:u.messages+1,last_message_at:t});
    }
  }

  const key = message.guild.id;
  const count = (messageBuckets.get(key) || 0) + 1;
  messageBuckets.set(key,count);
  if (g.catch_enabled && count >= g.catch_interval) {
    messageBuckets.set(key,0);
    sendCatch(message.guild).catch(console.error);
  }
});

client.on(Events.GuildMemberAdd, async member => {
  const guild = member.guild;
  const g = getGuild(guild.id);

  if (g.antiraid_enabled) {
    const list = joinBuckets.get(guild.id) || [];
    const t = now();
    const fresh = list.filter(x => t-x < g.antiraid_window*1000);
    fresh.push(t);
    joinBuckets.set(guild.id,fresh);
    if (fresh.length >= g.antiraid_threshold) {
      await log(guild,"🚨 Posible raid",`${fresh.length} miembros entraron en ${g.antiraid_window}s.`);
      if (g.antiraid_lockdown) await lockGuild(guild,60);
    }
  }

  if (member.user.bot) {
    try {
      const logs = await guild.fetchAuditLogs({type:AuditLogEvent.BotAdd,limit:5});
      const entry = logs.entries.find(e => e.target?.id === member.id);
      const executor = entry?.executor;
      await log(guild,"🤖 Bot añadido",`Bot: ${member}\nUsuario que lo añadió: ${executor ? executor : "desconocido"}`);
    } catch {}
  }

  if (g.welcome_enabled && g.welcome_channel_id) {
    const ch = guild.channels.cache.get(g.welcome_channel_id);
    if (ch?.isTextBased()) ch.send(replaceWelcome(g.welcome_text,member,guild)).catch(()=>{});
  }
  if (g.welcome_dm_enabled) member.send(replaceWelcome(g.welcome_dm_text,member,guild)).catch(()=>{});
});

function replaceWelcome(text, member, guild) {
  return String(text).replaceAll("{user}",member.toString()).replaceAll("{username}",member.user.username).replaceAll("{server}",guild.name);
}

client.on(Events.GuildMemberRemove, async member => {
  const g = getGuild(member.guild.id);
  if (g.goodbye_enabled && g.goodbye_channel_id) {
    const ch = member.guild.channels.cache.get(g.goodbye_channel_id);
    if (ch?.isTextBased()) ch.send(replaceWelcome(g.goodbye_text,member,member.guild)).catch(()=>{});
  }
  if (g.goodbye_dm_enabled) member.user.send(replaceWelcome(g.goodbye_dm_text,member,member.guild)).catch(()=>{});
});

client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
  const suspicious = [
    AuditLogEvent.ChannelCreate, AuditLogEvent.ChannelDelete,
    AuditLogEvent.RoleCreate, AuditLogEvent.RoleDelete,
    AuditLogEvent.WebhookCreate, AuditLogEvent.MemberBanAdd,
    AuditLogEvent.MemberKick, AuditLogEvent.MemberUpdate
  ];
  if (suspicious.includes(entry.action)) {
    const executor = entry.executor;
    if (executor?.bot) return;
    const member = executor ? guild.members.cache.get(executor.id) : null;
    if (member?.permissions.has(PermissionFlagsBits.Administrator)) return;
    await log(guild,"🛡️ Acción administrativa",`Acción: **${entry.action}**\nUsuario: ${executor || "desconocido"}\nObjetivo: ${entry.target ? String(entry.target) : "N/A"}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
