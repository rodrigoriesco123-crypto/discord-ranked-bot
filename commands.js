const {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  AttachmentBuilder
} = require("discord.js");
const { ensureGuild, getGuild, getUser, setUserFields, addMMR, setMMR, db } = require("./db");
const { RANKS, rankFromMMR, mmrForRank } = require("./ranks");
const { makeProfileCard } = require("./profile");

const commands = [
  new SlashCommandBuilder().setName("profile").setDescription("Muestra el perfil ranked de un usuario.")
    .addUserOption(o => o.setName("user").setDescription("Usuario opcional").setRequired(false)),
  new SlashCommandBuilder().setName("collection").setDescription("Muestra la colección Catch Me de un usuario.")
    .addUserOption(o => o.setName("user").setDescription("Usuario opcional").setRequired(false)),
  new SlashCommandBuilder().setName("points").setDescription("Muestra tus puntos ranked.")
    .addUserOption(o => o.setName("user").setDescription("Usuario opcional").setRequired(false)),
  new SlashCommandBuilder().setName("setpoints").setDescription("Configura los puntos por mensajes.")
    .addSubcommand(s => s.setName("enable").setDescription("Activa los puntos por mensajes."))
    .addSubcommand(s => s.setName("disable").setDescription("Desactiva los puntos por mensajes."))
    .addSubcommand(s => s.setName("amount").setDescription("Puntos por mensaje.").addIntegerOption(o => o.setName("value").setRequired(true).setMinValue(0).setMaxValue(100)))
    .addSubcommand(s => s.setName("cooldown").setDescription("Cooldown por usuario en segundos.").addIntegerOption(o => o.setName("seconds").setRequired(true).setMinValue(0).setMaxValue(3600))),
  new SlashCommandBuilder().setName("addpoints").setDescription("Añade MMR a un usuario.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName("user").setRequired(true).setDescription("Usuario"))
    .addIntegerOption(o => o.setName("amount").setRequired(true).setMinValue(1).setMaxValue(1000)),
  new SlashCommandBuilder().setName("removepoints").setDescription("Quita MMR a un usuario.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName("user").setRequired(true).setDescription("Usuario"))
    .addIntegerOption(o => o.setName("amount").setRequired(true).setMinValue(1).setMaxValue(1000)),
  new SlashCommandBuilder().setName("setpointsuser").setDescription("Establece el MMR total.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName("user").setRequired(true).setDescription("Usuario"))
    .addIntegerOption(o => o.setName("amount").setRequired(true).setMinValue(0).setMaxValue(2200)),
  new SlashCommandBuilder().setName("setrank").setDescription("Establece un rango y puntos.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName("user").setRequired(true).setDescription("Usuario"))
    .addStringOption(o => {
      o.setName("rank").setDescription("Rango").setRequired(true);
      for (const [name] of RANKS) o.addChoices({ name, value: name });
      return o;
    })
    .addIntegerOption(o => o.setName("points").setDescription("Puntos 1-100").setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName("setadivinanzas").setDescription("Configura Catch Me.")
    .addSubcommand(s => s.setName("enable").setDescription("Activa Catch Me."))
    .addSubcommand(s => s.setName("disable").setDescription("Desactiva Catch Me."))
    .addSubcommand(s => s.setName("channel").setDescription("Canal de Catch Me.").addChannelOption(o => o.setName("channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("interval").setDescription("Cada cuántos mensajes.").addIntegerOption(o => o.setName("messages").setRequired(true).setMinValue(1).setMaxValue(10000)))
    .addSubcommand(s => s.setName("reward").setDescription("Recompensa MMR.").addIntegerOption(o => o.setName("points").setRequired(true).setMinValue(1).setMaxValue(100))),
  new SlashCommandBuilder().setName("catchme").setDescription("Administra los cosméticos de Catch Me.")
    .addSubcommand(s => s.setName("add").setDescription("Añade un cosmético.").addStringOption(o => o.setName("name").setRequired(true)).addStringOption(o => o.setName("image").setRequired(true)).addStringOption(o => o.setName("game").setRequired(true).addChoices({name:"Rocket League",value:"Rocket League"},{name:"Fortnite",value:"Fortnite"})).addIntegerOption(o => o.setName("reward").setRequired(false).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName("list").setDescription("Lista cosméticos."))
    .addSubcommand(s => s.setName("remove").setDescription("Elimina un cosmético.").addIntegerOption(o => o.setName("id").setRequired(true))),
  new SlashCommandBuilder().setName("welcome").setDescription("Configura bienvenidas.")
    .addSubcommand(s => s.setName("enable").setDescription("Activa bienvenidas."))
    .addSubcommand(s => s.setName("disable").setDescription("Desactiva bienvenidas."))
    .addSubcommand(s => s.setName("channel").setDescription("Canal.").addChannelOption(o => o.setName("channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("text").setDescription("Mensaje.").addStringOption(o => o.setName("message").setRequired(true)))
    .addSubcommand(s => s.setName("dm").setDescription("Activa/desactiva MD.").addBooleanOption(o => o.setName("enabled").setRequired(true))),
  new SlashCommandBuilder().setName("goodbye").setDescription("Configura despedidas.")
    .addSubcommand(s => s.setName("enable").setDescription("Activa despedidas."))
    .addSubcommand(s => s.setName("disable").setDescription("Desactiva despedidas."))
    .addSubcommand(s => s.setName("channel").setDescription("Canal.").addChannelOption(o => o.setName("channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("text").setDescription("Mensaje.").addStringOption(o => o.setName("message").setRequired(true)))
    .addSubcommand(s => s.setName("dm").setDescription("Activa/desactiva MD.").addBooleanOption(o => o.setName("enabled").setRequired(true))),
  new SlashCommandBuilder().setName("logs").setDescription("Configura el canal de logs.")
    .addSubcommand(s => s.setName("set").setDescription("Establece canal.").addChannelOption(o => o.setName("channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("disable").setDescription("Desactiva logs.")),
  new SlashCommandBuilder().setName("antiraid").setDescription("Configura el anti-raid.")
    .addSubcommand(s => s.setName("enable").setDescription("Activa anti-raid."))
    .addSubcommand(s => s.setName("disable").setDescription("Desactiva anti-raid."))
    .addSubcommand(s => s.setName("threshold").setDescription("Entradas para activar alerta.").addIntegerOption(o => o.setName("joins").setRequired(true).setMinValue(2).setMaxValue(100)))
    .addSubcommand(s => s.setName("window").setDescription("Ventana en segundos.").addIntegerOption(o => o.setName("seconds").setRequired(true).setMinValue(3).setMaxValue(120)))
    .addSubcommand(s => s.setName("lockdown").setDescription("Activa/desactiva lockdown automático.").addBooleanOption(o => o.setName("enabled").setRequired(true))),
  new SlashCommandBuilder().setName("permissions").setDescription("Configura roles autorizados.")
    .addSubcommand(s => s.setName("set").setDescription("Asigna un rol a una función.").addStringOption(o => o.setName("feature").setRequired(true).addChoices(
      {name:"config",value:"config"},{name:"points_admin",value:"points_admin"},{name:"moderation",value:"moderation"},{name:"tickets",value:"tickets"},{name:"security",value:"security"}
    )).addRoleOption(o => o.setName("role").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Quita una restricción de rol.").addStringOption(o => o.setName("feature").setRequired(true).addChoices(
      {name:"config",value:"config"},{name:"points_admin",value:"points_admin"},{name:"moderation",value:"moderation"},{name:"tickets",value:"tickets"},{name:"security",value:"security"}
    )))
    .addSubcommand(s => s.setName("view").setDescription("Muestra permisos configurados.")),
  new SlashCommandBuilder().setName("ticket").setDescription("Sistema de tickets.")
    .addSubcommand(s => s.setName("setup").setDescription("Configura tickets.").addChannelOption(o => o.setName("panel_channel").setRequired(true).addChannelTypes(ChannelType.GuildText)).addChannelOption(o => o.setName("category").setRequired(false).addChannelTypes(ChannelType.GuildCategory)).addRoleOption(o => o.setName("staff_role").setRequired(false)))
    .addSubcommand(s => s.setName("panel").setDescription("Publica el panel de tickets."))
    .addSubcommand(s => s.setName("close").setDescription("Cierra el ticket actual.")),
  new SlashCommandBuilder().setName("mod").setDescription("Moderación.")
    .addSubcommand(s => s.setName("warn").setDescription("Advierte.").addUserOption(o => o.setName("user").setRequired(true)).addStringOption(o => o.setName("reason").setRequired(false)))
    .addSubcommand(s => s.setName("timeout").setDescription("Timeout.").addUserOption(o => o.setName("user").setRequired(true)).addIntegerOption(o => o.setName("minutes").setRequired(true).setMinValue(1).setMaxValue(40320)).addStringOption(o => o.setName("reason").setRequired(false)))
    .addSubcommand(s => s.setName("kick").setDescription("Expulsa.").addUserOption(o => o.setName("user").setRequired(true)).addStringOption(o => o.setName("reason").setRequired(false)))
    .addSubcommand(s => s.setName("ban").setDescription("Banea.").addUserOption(o => o.setName("user").setRequired(true)).addStringOption(o => o.setName("reason").setRequired(false))),
  new SlashCommandBuilder().setName("game").setDescription("Minijuegos sin apuestas.")
    .addSubcommand(s => s.setName("coinflip").setDescription("Cara o cruz."))
    .addSubcommand(s => s.setName("dice").setDescription("Lanza un dado.")),
  new SlashCommandBuilder().setName("config").setDescription("Resumen de configuración.")
].map(c => c.toJSON());

function isOwner(interaction) {
  return interaction.guild && interaction.guild.ownerId === interaction.user.id;
}

function hasFeaturePermission(interaction, feature) {
  if (!interaction.guild) return false;
  if (isOwner(interaction)) return true;
  const row = db.prepare("SELECT role_id FROM permissions WHERE guild_id=? AND feature=?").get(interaction.guild.id, feature);
  if (!row) return true;
  return interaction.member.roles.cache.has(row.role_id);
}

function requireFeature(interaction, feature) {
  if (!hasFeaturePermission(interaction, feature)) {
    throw new Error(`No tienes permiso para usar esta función (${feature}).`);
  }
}

function replaceVars(text, member, guild) {
  return String(text)
    .replaceAll("{user}", member.toString())
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", guild.name);
}

async function execute(interaction, client) {
  if (!interaction.guild) return interaction.reply({ content: "Este comando solo funciona en servidores.", ephemeral: true });
  ensureGuild(interaction.guild.id);

  const cmd = interaction.commandName;
  try {
    if (["setpoints","setadivinanzas","welcome","goodbye","logs","antiraid","permissions","config"].includes(cmd)) requireFeature(interaction, "config");
    if (["addpoints","removepoints","setpointsuser","setrank"].includes(cmd)) requireFeature(interaction, "points_admin");
    if (cmd === "ticket") requireFeature(interaction, "tickets");
    if (cmd === "mod") requireFeature(interaction, "moderation");

    if (cmd === "profile") {
      const member = interaction.options.getMember("user") || interaction.member;
      const data = getUser(interaction.guild.id, member.id);
      const rank = rankFromMMR(data.mmr);
      const card = await makeProfileCard({ user: member.user, data });
      const file = new AttachmentBuilder(card, { name: "profile.png" });
      const embed = new EmbedBuilder().setTitle("PERFIL").setDescription(
        `**Nombre:** ${member.user.username}\n**Título:** ${data.title || "Rookie"}\n**Banner:** ${data.banner || "Default"}\n**Foto:** ${member.user.displayAvatarURL({extension:"png",size:128})}\n**Marco:** ${data.frame || "Default"}\n\n-------------------------------------\n\n**RANKEDS**\n**MMR (Puntos):** ${data.mmr}\n**Rango:** ${rank.name}\n**Puntos de rango:** ${rank.progress}/100`
      ).setImage("attachment://profile.png");
      return interaction.reply({ embeds: [embed], files: [file] });
    }

    if (cmd === "points") {
      const member = interaction.options.getMember("user") || interaction.member;
      const data = getUser(interaction.guild.id, member.id);
      const rank = rankFromMMR(data.mmr);
      return interaction.reply(`${member} tiene **${data.mmr} MMR** — **${rank.name}** (${rank.progress}/100).`);
    }

    if (cmd === "collection") {
      const member = interaction.options.getMember("user") || interaction.member;
      const rows = db.prepare(`SELECT c.name,c.game,c.reward,col.caught_at FROM collections col JOIN cosmetics c ON c.id=col.cosmetic_id WHERE col.guild_id=? AND col.user_id=? ORDER BY col.caught_at DESC`)
        .all(interaction.guild.id, member.id);
      const desc = rows.length ? rows.slice(0, 25).map((x,i)=>`${i+1}. **${x.name}** — ${x.game}`).join("\n") : "Aún no tienes cosméticos atrapados.";
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`Colección de ${member.user.username}`).setDescription(desc)] });
    }

    if (cmd === "setpoints") {
      const sub = interaction.options.getSubcommand();
      const map = { enable:["points_enabled",1], disable:["points_enabled",0], amount:["points_per_message",interaction.options.getInteger("value")], cooldown:["points_cooldown",interaction.options.getInteger("seconds")] };
      const [field,value] = map[sub];
      db.prepare(`UPDATE guild_settings SET ${field}=? WHERE guild_id=?`).run(value, interaction.guild.id);
      return interaction.reply(`Configuración de puntos actualizada: **${field} = ${value}**.`);
    }

    if (cmd === "addpoints" || cmd === "removepoints" || cmd === "setpointsuser") {
      const member = interaction.options.getMember("user");
      if (!member) throw new Error("Usuario no encontrado.");
      const amount = interaction.options.getInteger("amount");
      const data = cmd === "addpoints" ? addMMR(interaction.guild.id, member.id, amount) :
        cmd === "removepoints" ? addMMR(interaction.guild.id, member.id, -amount) :
        setMMR(interaction.guild.id, member.id, amount);
      return interaction.reply(`${member} ahora tiene **${data.mmr} MMR** (**${rankFromMMR(data.mmr).name}**).`);
    }

    if (cmd === "setrank") {
      const member = interaction.options.getMember("user");
      const rank = interaction.options.getString("rank");
      const points = interaction.options.getInteger("points");
      const mmr = mmrForRank(rank, points);
      setMMR(interaction.guild.id, member.id, mmr);
      return interaction.reply(`${member} ahora es **${rank}** con **${points}/100** puntos.`);
    }

    if (cmd === "setadivinanzas") {
      const sub = interaction.options.getSubcommand();
      const values = {
        enable:["catch_enabled",1], disable:["catch_enabled",0],
        channel:["catch_channel_id",interaction.options.getChannel("channel").id],
        interval:["catch_interval",interaction.options.getInteger("messages")],
        reward:["catch_reward",interaction.options.getInteger("points")]
      };
      const [field,value] = values[sub];
      db.prepare(`UPDATE guild_settings SET ${field}=? WHERE guild_id=?`).run(value, interaction.guild.id);
      return interaction.reply(`Catch Me actualizado: **${field} = ${value}**.`);
    }

    if (cmd === "catchme") {
      const sub = interaction.options.getSubcommand();
      if (sub === "add") {
        const name = interaction.options.getString("name");
        const image = interaction.options.getString("image");
        const game = interaction.options.getString("game");
        const reward = interaction.options.getInteger("reward") || getGuild(interaction.guild.id).catch_reward;
        const info = db.prepare("INSERT INTO cosmetics (guild_id,name,image_url,game,reward) VALUES (?,?,?,?,?)").run(interaction.guild.id,name,image,game,reward);
        return interaction.reply(`Cosmético añadido con ID **${info.lastInsertRowid}**.`);
      }
      if (sub === "list") {
        const rows = db.prepare("SELECT id,name,game,reward FROM cosmetics WHERE guild_id=? AND enabled=1 ORDER BY id DESC LIMIT 30").all(interaction.guild.id);
        return interaction.reply(rows.length ? rows.map(x=>`**${x.id}** — ${x.name} (${x.game}) — +${x.reward}`).join("\n") : "No hay cosméticos.");
      }
      const id = interaction.options.getInteger("id");
      db.prepare("DELETE FROM cosmetics WHERE guild_id=? AND id=?").run(interaction.guild.id,id);
      return interaction.reply(`Cosmético **${id}** eliminado.`);
    }

    if (cmd === "welcome" || cmd === "goodbye") {
      const sub = interaction.options.getSubcommand();
      const prefix = cmd === "welcome" ? "welcome" : "goodbye";
      const maps = {
        enable:[`${prefix}_enabled`,1], disable:[`${prefix}_enabled`,0],
        channel:[`${prefix}_channel_id`,interaction.options.getChannel("channel").id],
        text:[`${prefix}_text`,interaction.options.getString("message")],
        dm:[`${prefix}_dm_enabled`,interaction.options.getBoolean("enabled") ? 1 : 0]
      };
      const [field,value] = maps[sub];
      db.prepare(`UPDATE guild_settings SET ${field}=? WHERE guild_id=?`).run(value, interaction.guild.id);
      return interaction.reply(`${cmd} actualizado.`);
    }

    if (cmd === "logs") {
      const sub = interaction.options.getSubcommand();
      const value = sub === "set" ? interaction.options.getChannel("channel").id : null;
      db.prepare("UPDATE guild_settings SET logs_channel_id=? WHERE guild_id=?").run(value, interaction.guild.id);
      return interaction.reply(value ? "Logs configurados." : "Logs desactivados.");
    }

    if (cmd === "antiraid") {
      const sub = interaction.options.getSubcommand();
      const vals = {
        enable:["antiraid_enabled",1], disable:["antiraid_enabled",0],
        threshold:["antiraid_threshold",interaction.options.getInteger("joins")],
        window:["antiraid_window",interaction.options.getInteger("seconds")],
        lockdown:["antiraid_lockdown",interaction.options.getBoolean("enabled") ? 1 : 0]
      };
      const [field,value] = vals[sub];
      db.prepare(`UPDATE guild_settings SET ${field}=? WHERE guild_id=?`).run(value, interaction.guild.id);
      return interaction.reply(`Anti-raid actualizado: **${field} = ${value}**.`);
    }

    if (cmd === "permissions") {
      const sub = interaction.options.getSubcommand();
      if (sub === "view") {
        const rows = db.prepare("SELECT feature,role_id FROM permissions WHERE guild_id=?").all(interaction.guild.id);
        return interaction.reply(rows.length ? rows.map(x=>`**${x.feature}** → <@&${x.role_id}>`).join("\n") : "No hay roles personalizados; se usan los permisos de Discord.");
      }
      const feature = interaction.options.getString("feature");
      if (sub === "set") {
        const role = interaction.options.getRole("role");
        db.prepare("INSERT INTO permissions(guild_id,feature,role_id) VALUES(?,?,?) ON CONFLICT(guild_id,feature) DO UPDATE SET role_id=excluded.role_id").run(interaction.guild.id,feature,role.id);
        return interaction.reply(`La función **${feature}** ahora requiere ${role}.`);
      }
      db.prepare("DELETE FROM permissions WHERE guild_id=? AND feature=?").run(interaction.guild.id,feature);
      return interaction.reply(`Se quitó la restricción personalizada de **${feature}**.`);
    }

    if (cmd === "ticket") {
      const sub = interaction.options.getSubcommand();
      const g = getGuild(interaction.guild.id);
      if (sub === "setup") {
        const panel = interaction.options.getChannel("panel_channel");
        const category = interaction.options.getChannel("category");
        const role = interaction.options.getRole("staff_role");
        db.prepare("UPDATE guild_settings SET ticket_channel_id=?,ticket_category_id=?,ticket_staff_role_id=? WHERE guild_id=?")
          .run(panel.id, category?.id || null, role?.id || null, interaction.guild.id);
        return interaction.reply(`Tickets configurados en ${panel}. Usa \`/ticket panel\` para publicar el botón.`);
      }
      if (sub === "panel") {
        const channel = g.ticket_channel_id ? interaction.guild.channels.cache.get(g.ticket_channel_id) : interaction.channel;
        if (!channel) throw new Error("Primero configura el canal con /ticket setup.");
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ticket:create").setLabel("Abrir ticket").setStyle(ButtonStyle.Danger).setEmoji("🎫")
        );
        await channel.send({ embeds:[new EmbedBuilder().setTitle("🎫 Soporte").setDescription("Pulsa el botón para abrir un ticket privado.")], components:[row] });
        return interaction.reply({content:"Panel publicado.",ephemeral:true});
      }
      if (!interaction.channel || !db.prepare("SELECT * FROM tickets WHERE channel_id=? AND status='open'").get(interaction.channel.id))
        throw new Error("Este canal no es un ticket abierto.");
      db.prepare("UPDATE tickets SET status='closed' WHERE channel_id=?").run(interaction.channel.id);
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages:false }).catch(()=>{});
      return interaction.reply("Ticket cerrado. Un administrador puede borrar el canal cuando quiera.");
    }

    if (cmd === "mod") {
      const sub = interaction.options.getSubcommand();
      const member = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason") || "Sin razón";
      if (sub === "warn") return interaction.reply(`${member} recibió un warning: **${reason}**`);
      if (sub === "timeout") {
        await member.timeout(interaction.options.getInteger("minutes") * 60000, reason);
        return interaction.reply(`${member} fue puesto en timeout.`);
      }
      if (sub === "kick") { await member.kick(reason); return interaction.reply(`${member} fue expulsado.`); }
      if (sub === "ban") { await member.ban({reason}); return interaction.reply(`${member} fue baneado.`); }
    }

    if (cmd === "game") {
      const sub = interaction.options.getSubcommand();
      if (sub === "coinflip") return interaction.reply(Math.random() < .5 ? "🪙 Cara" : "🪙 Cruz");
      return interaction.reply(`🎲 Salió **${Math.floor(Math.random()*6)+1}**.`);
    }

    if (cmd === "config") {
      const g = getGuild(interaction.guild.id);
      return interaction.reply({ embeds:[new EmbedBuilder().setTitle(`Configuración de ${interaction.guild.name}`).setDescription(
        `Puntos: **${g.points_enabled ? "ON" : "OFF"}** (${g.points_per_message}/mensaje, cooldown ${g.points_cooldown}s)\n` +
        `Catch Me: **${g.catch_enabled ? "ON" : "OFF"}**\n` +
        `Bienvenidas: **${g.welcome_enabled ? "ON" : "OFF"}**\n` +
        `Despedidas: **${g.goodbye_enabled ? "ON" : "OFF"}**\n` +
        `Anti-raid: **${g.antiraid_enabled ? "ON" : "OFF"}**\n` +
        `Logs: ${g.logs_channel_id ? `<#${g.logs_channel_id}>` : "OFF"}\n` +
        `Tickets: ${g.ticket_channel_id ? `<#${g.ticket_channel_id}>` : "NO CONFIGURADOS"}`
      )]});
    }
  } catch (e) {
    console.error(e);
    const msg = e?.message || "Ocurrió un error.";
    if (interaction.replied || interaction.deferred) return interaction.followUp({content:msg,ephemeral:true});
    return interaction.reply({content:msg,ephemeral:true});
  }
}

module.exports = { commands, execute };
