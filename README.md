# Discord Ranked + Security Bot

Bot para Discord preparado para Railway.

## Incluye

- `/profile [user]` con tarjeta gráfica roja/negra y rango del ZIP suministrado.
- Sistema MMR/rango por servidor, con puntos 1-100 por división.
- Puntos por mensajes, opcionales.
- `Catch Me!` opcional: cada X mensajes publica un cosmético y permite adivinarlo.
- Colecciones de cosméticos.
- Administración de puntos/rangos por owner o rol configurado.
- Tickets con panel y botones.
- Bienvenidas/despedidas en servidor y MD.
- Logs.
- Anti-raid configurable y lockdown.
- Protección/registro de entradas de bots.
- Permisos por función.
- Moderación básica.
- Juegos sin apuestas reales.
- Base de datos SQLite.

## Rangos

El proyecto ya contiene los 23 archivos del ZIP `Rangos rocket league.zip`.

## Railway

1. Sube este proyecto a GitHub.
2. En Railway crea un proyecto nuevo desde el repositorio.
3. Añade las variables:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - opcional `GUILD_ID` para registrar comandos rápidamente en un servidor de prueba.
   - opcional `DATABASE_PATH`
4. Railway ejecutará `npm install` y `npm start`.
5. Si quieres conservar SQLite después de reinicios/redeploys, añade un Volume de Railway y apunta `DATABASE_PATH` a una ruta persistente, por ejemplo `/data/bot.sqlite`.

## Discord Developer Portal

Activa los intents:
- Server Members Intent
- Message Content Intent

El bot necesita permisos suficientes para las funciones que quieras usar: Manage Channels, Manage Roles, Moderate Members, Kick/Ban Members, View Audit Log, Send Messages, Embed Links, Attach Files, Manage Webhooks, etc.

## Registrar comandos

Si `REGISTER_GLOBAL=false` y existe `GUILD_ID`, los comandos se registran en ese servidor.
Para registro global, usa `REGISTER_GLOBAL=true`.

También puedes ejecutar:
`npm run register`

## Seguridad

Nunca pongas el token del bot en GitHub. Usa Variables de entorno de Railway.

Este proyecto no incluye apuestas con dinero ni casino real. Los juegos son solo recreativos y los puntos del bot no tienen valor monetario.
