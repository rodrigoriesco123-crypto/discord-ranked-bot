const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { rankFromMMR, rankImagePath } = require("./ranks");

const framePath = path.resolve(process.env.PROFILE_FRAME_PATH || "./assets/profile-frame.png");

function safeText(s) {
  return String(s || "").replace(/[<>&'"]/g, "");
}

async function makeProfileCard({ user, data }) {
  const width = 1400, height = 470;
  const rank = rankFromMMR(data.mmr);
  const avatar = await fetch(user.displayAvatarURL({ extension: "png", size: 512 }))
    .then(r => r.arrayBuffer())
    .then(b => Buffer.from(b));

  const avatarCircle = await sharp(avatar)
    .resize(330, 330, { fit: "cover" })
    .png()
    .toBuffer();

  const rankImg = await sharp(rankImagePath(rank))
    .resize(180, 180, { fit: "contain" })
    .png()
    .toBuffer();

  const baseSvg = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" x2="1">
        <stop offset="0" stop-color="#070707"/>
        <stop offset="0.55" stop-color="#350000"/>
        <stop offset="1" stop-color="#090000"/>
      </linearGradient>
      <linearGradient id="red" x1="0" x2="1">
        <stop offset="0" stop-color="#ff1c1c"/>
        <stop offset="1" stop-color="#720000"/>
      </linearGradient>
    </defs>
    <rect width="1400" height="470" rx="28" fill="url(#bg)"/>
    <rect x="350" y="38" width="985" height="394" rx="20" fill="#110000" stroke="url(#red)" stroke-width="4"/>
    <rect x="350" y="38" width="985" height="100" rx="20" fill="#500000" opacity=".75"/>
    <text x="390" y="100" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="white">${safeText(user.username)}</text>
    <text x="390" y="178" font-family="Arial, sans-serif" font-size="28" fill="#ffb0b0">${safeText(data.title || "Rookie")}</text>
    <text x="390" y="240" font-family="Arial, sans-serif" font-size="26" fill="#ffffff">RANKED</text>
    <text x="390" y="290" font-family="Arial, sans-serif" font-size="24" fill="#ffdddd">MMR: ${data.mmr}</text>
    <text x="390" y="335" font-family="Arial, sans-serif" font-size="24" fill="#ffdddd">RANK: ${rank.name}</text>
    <text x="390" y="380" font-family="Arial, sans-serif" font-size="20" fill="#ff8f8f">POINTS: ${rank.progress}/100</text>
  </svg>`);

  const frame = fs.existsSync(framePath)
    ? await sharp(framePath).resize(width, height, { fit: "fill" }).png().toBuffer()
    : null;

  let img = sharp(baseSvg)
    .composite([
      { input: avatarCircle, left: 35, top: 70 },
      { input: rankImg, left: 1135, top: 145 }
    ]);

  if (frame) img = img.composite([{ input: frame, left: 0, top: 0, blend: "over" }]);

  return img.png().toBuffer();
}

module.exports = { makeProfileCard };
