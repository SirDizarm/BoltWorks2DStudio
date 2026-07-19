const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const inputPath = process.argv[2];
const outputDir = process.argv[3] || path.resolve("character-animation-output");
if (!inputPath) throw new Error("Usage: node build-ai-right-walk.js <input.boltchar> [output-directory]");

const backup = JSON.parse(fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, ""));
const character = backup.character;
if (!character?.animations?.walking?.length) throw new Error("The backup does not contain a right-facing walking frame.");

const clone = value => JSON.parse(JSON.stringify(value));
const parts = ["backArm", "backLeg", "torso", "head", "frontLeg", "frontArm"];
const base = clone(character.animations.walking[0]);
const basePart = part => base.parts[part];
const poses = [
  { torsoY:.85, headY:-.38, backArm:[  .00,-.39,-29], frontArm:[ 8.41, .91, 26], backLeg:[ .00, .00, 26,-9,21], frontLeg:[ .00,3.84,-22, 15,25] },
  { torsoY:.00, headY: .00, backArm:[  .26,-1.24, -3], frontArm:[ 4.38,-1.05, 12], backLeg:[ .00, .00, 12,-3,25], frontLeg:[ .55,1.65,-14, 10,25] },
  { torsoY:1.23, headY: .00, backArm:[  .00, .00, 17], frontArm:[  .00, .00, -7], backLeg:[ .00, .00, -7, 0,25], frontLeg:[ .00, .00,  2,  0,25] },
  { torsoY:.00, headY: .00, backArm:[-3.29,5.35, 43], frontArm:[-2.21,-1.23,-19], backLeg:[5.48,-.55, -9, 0,25], frontLeg:[ .55,1.72, 15,-10,25] },
  { torsoY:1.00, headY: .00, backArm:[-3.29,6.35, 53], frontArm:[-4.78, .14,-29], backLeg:[5.48,-.55,-24, 6,23], frontLeg:[ .00,3.72, 29, -6,25] },
  { torsoY:.00, headY: .00, backArm:[-3.29,5.35, 43], frontArm:[-2.21,-1.60,-19], backLeg:[5.48,-.55, -9, 6,25], frontLeg:[ .55,1.72, 15, -2,22] },
  { torsoY:1.23, headY: .00, backArm:[  .00, .00, 17], frontArm:[ -.37,-.36, -7], backLeg:[ .00, .00, -7, 0,25], frontLeg:[ .00, .00,  2,  0,25] },
  { torsoY:.00, headY: .00, backArm:[  .26,-1.24, -3], frontArm:[ 3.64,-.31, 12], backLeg:[ .00, .00, 12,-9,25], frontLeg:[ .55,1.65,-14,  0,25] }
];

function applyLimb(transform, rotation, bend, toeBend, options = {}) {
  transform.rotation = rotation;
  transform.bendAxis = "bottom";
  transform.bendZone = options.bendZone || 52;
  transform.bend = bend;
  transform.bendEnabled = Math.abs(bend) > 0.1;
  transform.toeCutAxis = options.toeCutAxis || "right";
  transform.toeBendZone = options.toeBendZone || 28;
  transform.toeBend = toeBend || 0;
  transform.toeBendEnabled = Math.abs(toeBend || 0) > 0.1;
  transform.shoeMoveX = options.shoeMoveX || 0;
  transform.shoeMoveY = options.shoeMoveY || 0;
  transform.toeMoveX = options.toeMoveX || 0;
  transform.toeMoveY = options.toeMoveY || 0;
}

character.animations.walking = poses.map((pose, index) => {
  const frame = clone(base);
  const torso = frame.parts.torso;
  const head = frame.parts.head;
  torso.y = basePart("torso").y + pose.torsoY;
  torso.x = basePart("torso").x;
  torso.rotation = 0;
  head.y = basePart("head").y + pose.headY;
  head.x = basePart("head").x;
  head.rotation = 0;

  const frontLeg = frame.parts.frontLeg;
  const backLeg = frame.parts.backLeg;
  frontLeg.x = basePart("frontLeg").x + pose.frontLeg[0];
  backLeg.x = basePart("backLeg").x + pose.backLeg[0];
  frontLeg.y = basePart("frontLeg").y + pose.frontLeg[1];
  backLeg.y = basePart("backLeg").y + pose.backLeg[1];
  frontLeg.sheetColumns = backLeg.sheetColumns = 6;
  frontLeg.sheetRows = backLeg.sheetRows = 1;
  frontLeg.sheetCell = backLeg.sheetCell = 1;
  frontLeg.brightness = 1;
  backLeg.brightness = 0.82;
  applyLimb(frontLeg, pose.frontLeg[2], pose.frontLeg[3], 0, { bendZone:pose.frontLeg[4], toeCutAxis:"right", toeBendZone:30, shoeMoveY:-2 });
  applyLimb(backLeg, pose.backLeg[2], pose.backLeg[3], 0, { bendZone:pose.backLeg[4], toeCutAxis:"right", toeBendZone:30, shoeMoveY:-2 });

  const frontArm = frame.parts.frontArm;
  const backArm = frame.parts.backArm;
  frontArm.sheetColumns = backArm.sheetColumns = 2;
  frontArm.sheetRows = backArm.sheetRows = 1;
  frontArm.sheetCell = 1;
  backArm.sheetCell = 2;
  frontArm.x = basePart("frontArm").x + pose.frontArm[0];
  frontArm.y = basePart("frontArm").y + pose.frontArm[1];
  backArm.x = basePart("backArm").x + pose.backArm[0];
  backArm.y = basePart("backArm").y + pose.backArm[1];
  frontArm.flip = false;
  backArm.flip = true;
  frontArm.brightness = 1;
  backArm.brightness = 0.9;
  applyLimb(frontArm, pose.frontArm[2], 0, 0, { bendZone:48, toeCutAxis:"bottom", toeBendZone:15 });
  applyLimb(backArm, pose.backArm[2], 0, 0, { bendZone:48, toeCutAxis:"bottom", toeBendZone:15 });
  return frame;
});

character.animationFps ||= {};
character.loopMode ||= {};
character.animationFps.walking = 10;
character.loopMode.walking = "normal";
character.partNames ||= {};
character.partNames.right = {
  ...(character.partNames.right || {}),
  backArm:"Far arm",
  backLeg:"Far leg",
  frontLeg:"Near leg",
  frontArm:"Near arm"
};

backup.version = Math.max(2, Number(backup.version) || 0);
backup.savedAt = new Date().toISOString();
backup.animationState = "walking";
backup.animationDirection = "right";
backup.characterFrameIndex = 0;
backup.selectedCharacterPart = "frontLeg";
backup.aiAnimation = {
  generator:"BoltWorks deterministic walk-cycle builder",
  view:"right",
  animation:"walking",
  frames:8,
  notes:"Eight-frame right-moving walk transferred from the user's earlier approved cycle: full opposing arm arcs, flipped far arm, alternating leg rotations and corrected bend signs."
};

fs.mkdirSync(outputDir, { recursive:true });
const outputBackup = path.join(outputDir, "boltworks-character-ai-right-walk-v2.boltchar");
fs.writeFileSync(outputBackup, JSON.stringify(backup, null, 2));

const assetMap = new Map(backup.assets.map(asset => [asset.id, asset]));
const imageCache = new Map();
async function cellData(transform) {
  const key = `${transform.assetId}:${transform.sheetColumns || 1}:${transform.sheetRows || 1}:${transform.sheetCell || 1}`;
  if (imageCache.has(key)) return imageCache.get(key);
  const asset = assetMap.get(transform.assetId);
  if (!asset) return null;
  const input = Buffer.from(asset.src.split(",", 2)[1], "base64");
  const metadata = await sharp(input).metadata();
  const columns = Math.max(1, Math.round(Number(transform.sheetColumns) || 1));
  const rows = Math.max(1, Math.round(Number(transform.sheetRows) || 1));
  const cell = Math.max(0, Math.min(columns * rows - 1, Math.round(Number(transform.sheetCell) || 1) - 1));
  const width = Math.floor(metadata.width / columns);
  const height = Math.floor(metadata.height / rows);
  const left = (cell % columns) * width;
  const top = Math.floor(cell / columns) * height;
  const buffer = await sharp(input).extract({ left, top, width, height }).png().toBuffer();
  const result = { buffer, width, height };
  imageCache.set(key, result);
  return result;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[char]);
}

async function frameSvg(frame, frameNumber) {
  const elements = [];
  for (const part of character.partOrder || parts) {
    const transform = frame.parts[part];
    const cell = await cellData(transform);
    if (!cell) continue;
    const scale = (Number(transform.scale) || 1);
    const widthScale = Number(transform.widthScale) || 1;
    const heightScale = Number(transform.heightScale) || 1;
    const width = cell.width * scale * widthScale;
    const height = cell.height * scale * heightScale;
    const anchorX = -width / 2;
    const anchorY = part === "head" || part === "torso" ? -height / 2 : 0;
    const href = `data:image/png;base64,${cell.buffer.toString("base64")}`;
    const flip = transform.flip ? -1 : 1;
    const rotation = Number(transform.rotation) || 0;
    const brightness = Math.max(0.2, Number(transform.brightness) || 1);
    const id = `${frameNumber}-${part}`;
    const image = `<image href="${href}" x="${anchorX}" y="${anchorY}" width="${width}" height="${height}"/>`;
    let content = image;
    const bend = Number(transform.bend) || 0;
    const bendOn = transform.bendEnabled && Math.abs(bend) > 0.1 && (transform.bendAxis || "bottom") === "bottom";
    if (bendOn) {
      const zone = Math.max(0.05, Math.min(0.7, (Number(transform.bendZone) || 25) / 100));
      const cutY = anchorY + height * (1 - zone);
      const shoeX = Number(transform.shoeMoveX) || 0;
      const shoeY = Number(transform.shoeMoveY) || 0;
      const toe = Number(transform.toeBend) || 0;
      const toeOn = transform.toeBendEnabled && Math.abs(toe) > 0.1 && transform.toeCutAxis === "right";
      const toeZone = Math.max(0.01, Math.min(0.9, (Number(transform.toeBendZone) || 30) / 100));
      const toeX = anchorX + width * (1 - toeZone);
      const upperClip = `<clipPath id="upper-${id}"><rect x="${anchorX}" y="${anchorY}" width="${width}" height="${cutY-anchorY}"/></clipPath>`;
      const lowerClip = `<clipPath id="lower-${id}"><rect x="${anchorX}" y="${cutY}" width="${toeOn?width*(1-toeZone):width}" height="${anchorY+height-cutY}"/></clipPath>`;
      const toeClip = toeOn ? `<clipPath id="toe-${id}"><rect x="${toeX}" y="${cutY}" width="${width*toeZone}" height="${anchorY+height-cutY}"/></clipPath>` : "";
      const lowerTransform = `translate(${shoeX} ${shoeY}) translate(0 ${cutY}) rotate(${bend}) translate(0 ${-cutY})`;
      const lower = `<g transform="${lowerTransform}"><g clip-path="url(#lower-${id})">${image}</g>${toeOn?`<g transform="translate(${toeX} ${cutY}) rotate(${toe}) translate(${-toeX} ${-cutY})" clip-path="url(#toe-${id})">${image}</g>`:""}</g>`;
      content = `<defs>${upperClip}${lowerClip}${toeClip}</defs><g clip-path="url(#upper-${id})">${image}</g>${lower}`;
    }
    elements.push(`<g transform="translate(${Number(transform.x)||0} ${Number(transform.y)||0}) rotate(${rotation}) scale(${flip} 1)" opacity="${brightness < 1 ? brightness : 1}">${content}</g>`);
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${character.width}" height="${character.height}" viewBox="0 0 ${character.width} ${character.height}">${elements.join("")}</svg>`);
}

async function renderPreview() {
  const frames = [];
  for (let index = 0; index < character.animations.walking.length; index++) {
    frames.push(await sharp(await frameSvg(character.animations.walking[index], index)).png().toBuffer());
  }
  const sheet = sharp({ create:{ width:character.width * frames.length, height:character.height, channels:4, background:{r:0,g:0,b:0,alpha:0} } });
  await sheet.composite(frames.map((input, index) => ({ input, left:index * character.width, top:0 }))).png().toFile(path.join(outputDir, "boltworks-character-ai-right-walk-v2-sheet.png"));
}

renderPreview().then(() => {
  console.log(outputBackup);
  console.log(path.join(outputDir, "boltworks-character-ai-right-walk-v2-sheet.png"));
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
