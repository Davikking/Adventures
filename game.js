// =============== EDIT THESE ===============
const herName = "Emily";
const yourName = "Christoph";
const noteLines = [
  `Hey ${herName}, you found everything!`,
  "I'm really loving getting to know you. You're beautiful, funny and I have really enjoyed every moment so far.",
  "Want to go on a third date with me? Head north and pick a path."
];
const choices = {
  birds:  { title: "Bird watching!", text: "Binoculars, a quiet trail, and good company. It's a date.", sms: "Bird watching! 11:30 am Saturday September 26th" },
  apples: { title: "Apple picking!", text: "An orchard, a full basket, and maybe some cider after. It's a date.", sms: "Apple picking! 11:30 am Saturday September 26th" }
};
// ==========================================

const TILE = 16, VIEW_W = 160, VIEW_H = 144;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// ---------- Map ----------
// . grass   , path   g tall grass   * flowers   ~ water   T tree   A apple tree
// b bush    R rock   # fence        G gate      S sign    C chest   D fishing dock
// B bird watching spot   P apple picking spot
const mapRows = [
  "TTTTTTTTTTTTTTTTTTTTTTTT",
  "T~~~~~......T.....A.A.AT",
  "T~~~~~..,B,.T..,P,.....T",
  "T~~~~...,...T...,..A.A.T",
  "Tgg.....,...T...,......T",
  "Tgg.S...,,,,,,,,,..S...T",
  "T...........,..........T",
  "T...........,..........T",
  "############G###########",
  "T...........,.........bT",
  "T..A.A......,....R.....T",
  "T...........,..........T",
  "T.A.A.A....S,C.........T",
  "T...........,.......gggT",
  "T.**........,.......gggT",
  "T.**....,,,,,,,,,,..gggT",
  "T.......,....D...,.....T",
  "TTT.....,..~~~~..,..TTTT",
  "T.......,..~~~~..,.....T",
  "T.b.b...,..~~~~..,..*..T",
  "T.......,........,..**.T",
  "T..R....,,,,,,,,,,.....T",
  "T...........,..........T",
  "T.gggg.....,,,.....A.A.T",
  "T.gggg......,..........T",
  "T.gggg......,.....A.A..T",
  "T....**.....,..........T",
  "T....**.....,.....b....T",
  "T...........,S.........T",
  "TTTTTTTTTTTTTTTTTTTTTTTT"
];
const gameMap = mapRows.map(rowText => rowText.split(""));
const mapWidth = gameMap[0].length, mapHeight = gameMap.length;

const signTexts = {
  "11,12": ["TREASURE CHEST", "Five hidden things open it. Look everywhere!"],
  "4,5":   ["WEST: Pond Overlook", "The best spot around for bird watching."],
  "19,5":  ["EAST: The Orchard", "Pick-your-own apples, all season long."],
  "13,28": ["PARK ENTRANCE", `Someone hid a few things in here for ${herName}...`]
};

const items = [
  { id: "apple",   label: "APPLE",      col: 21, row: 23, found: false, onGround: false,
    hint: "One tree in the southeast orchard is extra full. Stand next to the trees and press A to shake them." },
  { id: "feather", label: "FEATHER",    col: 3,  row: 19, found: false, onGround: false,
    hint: "A bluebird is sitting by the bushes on the far west side. Birds get shy when you walk up..." },
  { id: "leaf",    label: "MAPLE LEAF", col: 21, row: 14, found: false, onGround: true,
    hint: "Watch the tall grass in the northeast corner. One spot keeps rustling." },
  { id: "acorn",   label: "ACORN",      col: 2,  row: 16, found: false, onGround: false,
    hint: "A squirrel on the west side has an acorn. She's a tough trader, though. Maybe she wants something pretty?" },
  { id: "key",     label: "KEY",        col: 13, row: 17, found: false, onGround: false,
    hint: "I saw something shiny sink in the pond. Stand on the little dock, face the water, and press A to fish." }
];
const itemById = Object.fromEntries(items.map(item => [item.id, item]));
const specialAppleTree = { col: 21, row: 23 };
const squirrel = { col: 2, row: 16, hasFlower: false };
const bird = { col: 3, row: 19, phase: "sitting", startedAt: 0 };
const dock = { col: 13, row: 16 };
let hasFlower = false, fishing = null, fishCatches = 0, treeShake = null;

const ranger = { col: 14, row: 26, dir: "down" };
const player = { col: 12, row: 27, dir: "up", moving: false, fromCol: 12, fromRow: 27, toCol: 12, toRow: 27, progress: 0, stepCount: 0, turnTimer: 0, lastArrive: 0 };

let started = false, chestOpen = false, gateOpen = false, forkIntroShown = false, rangerMet = false;
let dialog = null, noteCallback = null, endOpen = false;
let pendingA = false, pendingB = false;
let lastBump = 0;

// ---------- Pixel helpers ----------
function makeCanvas(drawFunction) {
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = tileCanvas.height = TILE;
  const g = tileCanvas.getContext("2d");
  drawFunction(g);
  return tileCanvas;
}
function rect(g, x, y, w, h, color) { g.fillStyle = color; g.fillRect(x, y, w, h); }
function disc(g, centerX, centerY, radius, color) {
  g.fillStyle = color;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx * dx + dy * dy <= radius * radius + radius * 0.8) g.fillRect(centerX + dx, centerY + dy, 1, 1);
}

// ---------- Tiles ----------
const grassColor = "#7CC26A", grassDark = "#5FA852";
function tuft(g, x, y) { rect(g, x, y, 1, 2, grassDark); rect(g, x + 2, y, 1, 2, grassDark); rect(g, x + 1, y - 1, 1, 2, grassDark); }
function grassBase(g) { rect(g, 0, 0, 16, 16, grassColor); }
function pathBase(g) {
  rect(g, 0, 0, 16, 16, "#E3C690");
  rect(g, 3, 3, 2, 1, "#CDAE74"); rect(g, 11, 7, 1, 1, "#CDAE74"); rect(g, 6, 12, 2, 1, "#CDAE74"); rect(g, 13, 13, 1, 1, "#CDAE74");
}
function treeShape(g) {
  rect(g, 6, 11, 4, 5, "#6B4A33");
  disc(g, 8, 7, 7, "#1F4D33"); disc(g, 8, 7, 6, "#2F7A47"); disc(g, 6, 5, 2, "#4AA05E");
}
function flower(g, x, y, color) {
  rect(g, x, y - 1, 1, 1, color); rect(g, x - 1, y, 3, 1, color); rect(g, x, y + 1, 1, 1, color); rect(g, x, y, 1, 1, "#FFF3A0");
}
function tallGrass(g) {
  grassBase(g);
  [[1, 2], [6, 0], [11, 2], [3, 8], [8, 6], [13, 8], [0, 10], [10, 11]].forEach(([x, y]) => {
    rect(g, x, y + 1, 1, 5, "#3F8A45"); rect(g, x + 1, y, 1, 6, "#56A34F"); rect(g, x + 2, y + 1, 1, 5, "#3F8A45");
  });
}

const tiles = {
  grassA: makeCanvas(g => { grassBase(g); tuft(g, 3, 5); tuft(g, 11, 11); }),
  grassB: makeCanvas(g => { grassBase(g); tuft(g, 9, 3); tuft(g, 4, 12); }),
  path: makeCanvas(pathBase),
  tall: makeCanvas(tallGrass),
  flowers: makeCanvas(g => { grassBase(g); flower(g, 4, 4, "#E0574F"); flower(g, 11, 6, "#FFFFFF"); flower(g, 6, 11, "#F0C040"); flower(g, 12, 12, "#E0574F"); }),
  water0: makeCanvas(g => { rect(g, 0, 0, 16, 16, "#4A90C8"); rect(g, 2, 4, 4, 1, "#8CC4EA"); rect(g, 9, 11, 4, 1, "#8CC4EA"); }),
  water1: makeCanvas(g => { rect(g, 0, 0, 16, 16, "#4A90C8"); rect(g, 4, 5, 4, 1, "#8CC4EA"); rect(g, 10, 10, 4, 1, "#8CC4EA"); }),
  tree: makeCanvas(g => { grassBase(g); treeShape(g); }),
  appleTree: makeCanvas(g => {
    grassBase(g); treeShape(g);
    [[4, 7], [10, 4], [9, 9], [5, 3], [12, 7]].forEach(([x, y]) => { rect(g, x, y, 2, 2, "#D23C34"); rect(g, x, y, 1, 1, "#F08A80"); });
  }),
  bush: makeCanvas(g => { grassBase(g); disc(g, 8, 9, 6, "#2C6B3F"); disc(g, 8, 9, 5, "#3F8F55"); rect(g, 6, 6, 2, 2, "#5FB070"); }),
  rock: makeCanvas(g => { grassBase(g); disc(g, 8, 10, 5, "#5D5D58"); disc(g, 8, 10, 4, "#9A9A8E"); rect(g, 6, 8, 2, 1, "#C4C4B8"); }),
  fence: makeCanvas(g => {
    grassBase(g);
    rect(g, 0, 6, 16, 2, "#8C6A4E"); rect(g, 0, 11, 16, 2, "#8C6A4E");
    rect(g, 1, 3, 3, 12, "#6B4A33"); rect(g, 12, 3, 3, 12, "#6B4A33");
    rect(g, 1, 3, 3, 1, "#A47E5C"); rect(g, 12, 3, 3, 1, "#A47E5C");
  }),
  gate: makeCanvas(g => {
    pathBase(g);
    for (let bar = 0; bar < 5; bar++) rect(g, 1 + bar * 3, 3, 2, 12, "#C9962E");
    rect(g, 0, 6, 16, 2, "#E2B448"); rect(g, 0, 11, 16, 1, "#E2B448");
    rect(g, 6, 8, 4, 4, "#1E1A22"); rect(g, 7, 9, 2, 2, "#8A8A8A");
  }),
  sign: makeCanvas(g => {
    grassBase(g);
    rect(g, 7, 10, 2, 6, "#6B4A33"); rect(g, 2, 3, 12, 8, "#4E3424"); rect(g, 3, 4, 10, 6, "#C79A62");
    rect(g, 4, 6, 8, 1, "#8A6440"); rect(g, 4, 8, 6, 1, "#8A6440");
  }),
  chestClosed: makeCanvas(g => {
    grassBase(g);
    rect(g, 2, 5, 12, 10, "#1E1A22"); rect(g, 3, 6, 10, 8, "#9A5B2A"); rect(g, 3, 6, 10, 2, "#B8773D");
    rect(g, 3, 9, 10, 1, "#E2A83B"); rect(g, 7, 8, 2, 4, "#E2A83B"); rect(g, 7, 10, 2, 1, "#1E1A22");
  }),
  chestOpen: makeCanvas(g => {
    grassBase(g);
    rect(g, 2, 2, 12, 6, "#1E1A22"); rect(g, 3, 3, 10, 4, "#7A4520");
    rect(g, 2, 8, 12, 7, "#1E1A22"); rect(g, 3, 9, 10, 5, "#9A5B2A"); rect(g, 3, 9, 10, 1, "#3A2414");
    rect(g, 3, 11, 10, 1, "#E2A83B");
  })
};
tiles.tallOverlay = tiles.tall;
tiles.dock = makeCanvas(g => {
  grassBase(g);
  rect(g, 1, 2, 14, 14, "#6B4A33");
  for (let plank = 0; plank < 4; plank++) rect(g, 2, 3 + plank * 3, 12, 2, plank % 2 ? "#B98452" : "#A8763F");
  rect(g, 1, 14, 2, 2, "#4E3424"); rect(g, 13, 14, 2, 2, "#4E3424");
});

const squirrelArt = [0, 1].map(frame => makeCanvas(g => {
  const fur = "#9B6A3C", light = "#C99664", dark = "#1E1A22";
  disc(g, 11, frame ? 6 : 7, 3, "#B98452"); rect(g, 10, 9, 3, 3, "#B98452");
  disc(g, 7, 11, 3, fur); rect(g, 6, 12, 3, 2, light);
  disc(g, 5, 8, 2, fur); rect(g, 4, 5, 1, 2, fur); rect(g, 6, 5, 1, 2, fur);
  rect(g, 4, 8, 1, 1, dark); rect(g, 3, 9, 1, 1, dark);
  rect(g, 5, 14, 2, 1, fur); rect(g, 8, 14, 2, 1, fur);
}));

// ---------- Items ----------
const itemArt = {
  apple: makeCanvas(g => {
    rect(g, 5, 14, 6, 1, "rgba(0,0,0,.2)");
    rect(g, 5, 6, 6, 7, "#C8423B"); rect(g, 4, 7, 8, 5, "#C8423B"); rect(g, 6, 7, 1, 2, "#F08A80");
    rect(g, 8, 3, 1, 3, "#6B4A33"); rect(g, 9, 3, 2, 1, "#5E9B4F"); rect(g, 10, 2, 1, 1, "#5E9B4F");
  }),
  feather: makeCanvas(g => {
    rect(g, 4, 14, 8, 1, "rgba(0,0,0,.2)");
    for (let i = 0; i < 7; i++) rect(g, 5 + i, 10 - i, 3, 2, i % 2 ? "#5B8FB9" : "#7FAED4");
    rect(g, 3, 12, 3, 1, "#2F4A6A"); rect(g, 4, 11, 1, 1, "#2F4A6A");
  }),
  leaf: makeCanvas(g => {
    rect(g, 5, 14, 6, 1, "rgba(0,0,0,.2)");
    rect(g, 5, 5, 6, 6, "#E0762F"); rect(g, 3, 6, 2, 3, "#E0762F"); rect(g, 11, 6, 2, 3, "#E0762F");
    rect(g, 7, 3, 2, 2, "#E0762F"); rect(g, 6, 11, 4, 1, "#E0762F"); rect(g, 7, 6, 2, 1, "#F4A160");
    rect(g, 8, 11, 1, 3, "#8A3F12");
  }),
  acorn: makeCanvas(g => {
    rect(g, 5, 14, 6, 1, "rgba(0,0,0,.2)");
    rect(g, 5, 5, 6, 3, "#6B4A33"); rect(g, 8, 3, 1, 2, "#6B4A33");
    rect(g, 6, 8, 4, 4, "#B7793B"); rect(g, 7, 12, 2, 1, "#B7793B"); rect(g, 6, 8, 1, 2, "#D59A5B");
  }),
  key: makeCanvas(g => {
    rect(g, 3, 14, 10, 1, "rgba(0,0,0,.2)");
    rect(g, 3, 5, 4, 1, "#E2A83B"); rect(g, 3, 9, 4, 1, "#E2A83B"); rect(g, 2, 6, 1, 3, "#E2A83B"); rect(g, 7, 6, 1, 3, "#E2A83B");
    rect(g, 8, 7, 6, 1, "#E2A83B"); rect(g, 11, 8, 1, 2, "#E2A83B"); rect(g, 13, 8, 1, 2, "#E2A83B");
    rect(g, 3, 6, 1, 1, "#FFF3A0");
  })
};

// ---------- Characters ----------
const basePalette = { k: "#1E1A22", h: "#6B3E26", s: "#F2C29B", j: "#3F8F5E", J: "#2C6B45", p: "#34435E", w: "#FFFFFF" };
const rangerPalette = { ...basePalette, h: "#7A5A2E", j: "#B8A36A", J: "#8A7A48", p: "#5A4A30" };

const bodyDown = [
  "................", "......kkkk......", "....kkhhhhkk....", "...khhhhhhhhk...", "...khhhhhhhhk...",
  "..khhsssssshhk..", "..khsskssksshk..", "...kssssssssk...", "....kkjjjjkk....",
  "...kjjjwwjjjk...", "..ksjjjjjjjjsk..", "..ksJjjjjjjJsk..", "...kJJJJJJJJk..."
];
const bodyUp = [
  "................", "......kkkk......", "....kkhhhhkk....", "...khhhhhhhhk...", "...khhhhhhhhk...",
  "..khhhhhhhhhhk..", "..khhhhhhhhhhk..", "...khhhhhhhhk...", "....kkjjjjkk....",
  "...kjjjjjjjjk...", "..ksjjjjjjjjsk..", "..ksJjjjjjjJsk..", "...kJJJJJJJJk..."
];
const bodySide = [
  "................", "......kkkk......", "....kkhhhhkk....", "...khhhhhhhhk...", "...khhhhhhhhk...",
  "..khhhhhsssssk..", "..khhhhhsskssk..", "...khhhssssssk..", "....kkjjjjkk....",
  "...kjjjjjjjjk...", "...kjjjjsjjjk...", "...kJjjjjjjJk...", "...kJJJJJJJJk..."
];
const legs = {
  stand: ["....kppkkppk....", "....kppkkppk....", "....kkk..kkk...."],
  walkA: ["....kppkkppk....", "....kppk.kkk....", "....kkk........."],
  walkB: ["....kppkkppk....", "....kkk.kppk....", ".........kkk...."],
  sideStand: [".....kppppk.....", ".....kppppk.....", ".....kkkkkk....."],
  sideWalk: ["....kppkkppk....", "...kppk..kppk...", "...kkk....kkk..."]
};


// ---------- Emily (16 x 20) ----------
const emilyPalette = {
  k: "#1E1A22",               // outline, choker, belt
  h: "#5A1E2A", H: "#83303F",  // burgundy hair + highlight
  s: "#F6D5C3",               // skin
  l: "#B8232F",               // red lipstick
  d: "#1F4A42", D: "#CFE6DE",  // green and white gingham
  t: "#2B2530",               // black tights
  w: "#F2F2F2"                // white sneaker soles
};
const emilyDown = [
  "................", ".....kkkkkk.....", "....kHHhhhhk....", "...khHhhhhhhk...", "...khhhhhhhhk...",
  "..khhsssssshhk..", "..khsskssksshk..", "..khsssssssshk..", "..khhssllsshhk..", "..khhkkkkkkhhk..",
  "..khDdssssdDhk..", ".khhdDdDdDdDhhk.", ".khsDdDdDdDdshk.", ".khsdDdDdDdDshk.", ".khskkkkkkkkshk.",
  ".khdDdDdDdDdDhk.", "..kkkkkkkkkkkk.."
];
const emilyUp = [
  "................", ".....kkkkkk.....", "....khhhhhhk....", "...khHhhhhhhk...", "...khhhhhhhhk...",
  "..khhhhhhhhhhk..", "..khhhhhhhhhhk..", "..khhhhhhhhhhk..", "..khhhhhhhhhhk..", "..khhhhhhhhhhk..",
  "..kDhhhhhhhhDk..", ".kdDhhhhhhhhDdk.", ".ksDhhhhhhhhDsk.", ".ksdhhhhhhhhdsk.", ".kskkhhhhhhkksk.",
  "..kdDhhhhhhDdk..", "..kkkkkkkkkkkk.."
];
const emilySide = [
  "................", ".....kkkkkk.....", "....kHHhhhhk....", "...khHhhhhhhk...", "...khhhhhhhhk...",
  "..khhhhhhsssk...", "..khhhhhhskssk..", "..khhhhhhssssk..", "..khhhhhhsslk...", "..khhhhhkkkk....",
  "..khhhhDdDdDk...", "..khhhhdDdDdk...", "..khhhhDdsdDk...", "..khhhhdDsDdk...", "...khhkkskkkk...",
  "...khhdDdDdDdk..", "...kkkkkkkkkkk.."
];
const emilyLegs = {
  stand: ["....kttkkttk....", "....kttkkttk....", "...kwwk..kwwk..."],
  walkA: ["....kttkkttk....", "....kttk.kkk....", "...kwwk........."],
  walkB: ["....kttkkttk....", "....kkk.kttk....", ".........kwwk..."],
  sideStand: [".....kttttk.....", ".....kttttk.....", ".....kkwwwwk...."],
  sideWalk: ["....kttkkttk....", "...kttk..kttk...", "..kwwk....kwwk.."]
};

function buildSprite(rows, palette, flip) {
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = 16;
  spriteCanvas.height = rows.length;
  const g = spriteCanvas.getContext("2d");
  {
    rows.forEach((rowText, y) => {
      for (let x = 0; x < 16; x++) {
        const code = rowText[x];
        if (!code || code === ".") continue;
        g.fillStyle = palette[code];
        g.fillRect(flip ? 15 - x : x, y, 1, 1);
      }
    });
  }
  return spriteCanvas;
}
function buildCharacter(palette, bodies = { down: bodyDown, up: bodyUp, side: bodySide }, legSet = legs) {
  const bodyDown = bodies.down, bodyUp = bodies.up, bodySide = bodies.side, legs = legSet;
  const sheet = {};
  sheet.down = [bodyDown.concat(legs.stand), bodyDown.concat(legs.walkA), bodyDown.concat(legs.walkB)].map(rows => buildSprite(rows, palette, false));
  sheet.up = [bodyUp.concat(legs.stand), bodyUp.concat(legs.walkA), bodyUp.concat(legs.walkB)].map(rows => buildSprite(rows, palette, false));
  const sideFrames = [bodySide.concat(legs.sideStand), bodySide.concat(legs.sideWalk), bodySide.concat(legs.sideStand)];
  sheet.right = sideFrames.map(rows => buildSprite(rows, palette, false));
  sheet.left = sideFrames.map(rows => buildSprite(rows, palette, true));
  return sheet;
}
const emilySprites = buildCharacter(emilyPalette, { down: emilyDown, up: emilyUp, side: emilySide }, emilyLegs);
const rangerSprites = buildCharacter(rangerPalette);
{
  const titleSpriteContext = document.getElementById("titleSprite").getContext("2d");
  titleSpriteContext.imageSmoothingEnabled = false;
  titleSpriteContext.drawImage(emilySprites.down[0], 0, 0);
}

// ---------- Sound ----------
let audioContext = null;
let soundOn = true;
try { soundOn = localStorage.getItem("autumnHuntSound") !== "off"; } catch (error) {}
const soundButton = document.getElementById("soundButton");
soundButton.textContent = soundOn ? "Sound: on" : "Sound: off";
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? "Sound: on" : "Sound: off";
  try { localStorage.setItem("autumnHuntSound", soundOn ? "on" : "off"); } catch (error) {}
});
function unlockAudio() {
  if (audioContext) return;
  try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch (error) {}
}
function beep(frequency, duration, delay = 0, volume = 0.035) {
  if (!audioContext || !soundOn) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  const startAt = audioContext.currentTime + delay;
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}
function jingle(notes) {
  let delay = 0;
  notes.forEach(([frequency, duration]) => { beep(frequency, duration, delay); delay += duration * 0.9; });
}
const pickupJingle = [[523, .09], [659, .09], [784, .09], [1047, .22]];
const chestJingle = [[392, .1], [523, .1], [659, .1], [784, .1], [659, .1], [784, .3]];
const gateJingle = [[196, .15], [147, .15], [196, .25]];
const endJingle = [[523, .12], [523, .12], [523, .12], [659, .3], [587, .12], [659, .12], [784, .45]];

// ---------- Dialog ----------
const dialogBox = document.getElementById("dialog");
const dialogText = document.getElementById("dialogText");
const dialogArrow = document.getElementById("dialogArrow");

function say(lines, onDone) {
  dialog = { lines, index: 0, chars: 0, lastBlip: 0, onDone };
  dialogText.textContent = "";
  dialogArrow.hidden = true;
  dialogBox.hidden = false;
}
function advanceDialog() {
  const line = dialog.lines[dialog.index];
  if (dialog.chars < line.length) { dialog.chars = line.length; return; }
  dialog.index++;
  dialog.chars = 0;
  beep(880, 0.04);
  if (dialog.index >= dialog.lines.length) {
    const onDone = dialog.onDone;
    dialog = null;
    dialogBox.hidden = true;
    if (onDone) onDone();
  }
}
function updateDialog(deltaMs) {
  if (!dialog) return;
  const line = dialog.lines[dialog.index];
  if (dialog.chars < line.length) {
    dialog.chars = Math.min(line.length, dialog.chars + deltaMs * 0.045);
    const shownCount = Math.floor(dialog.chars);
    if (shownCount - dialog.lastBlip >= 3) { dialog.lastBlip = shownCount; beep(620, 0.02, 0, 0.015); }
  }
  dialogText.textContent = line.slice(0, Math.floor(dialog.chars));
  dialogArrow.hidden = dialog.chars < line.length;
  if (dialog.chars >= line.length) dialog.lastBlip = 0;
}

// ---------- Note & ending ----------
const noteOverlay = document.getElementById("noteOverlay");
function showNote(onClose) {
  document.getElementById("noteBody").textContent = noteLines.join(" ");
  document.getElementById("noteSign").textContent = "— " + yourName;
  noteOverlay.hidden = false;
  noteCallback = onClose;
}
function closeNote() {
  noteOverlay.hidden = true;
  const callback = noteCallback;
  noteCallback = null;
  if (callback) callback();
}
noteOverlay.addEventListener("click", closeNote);

const endOverlay = document.getElementById("endOverlay");
function showEnding(choiceKey) {
  const choice = choices[choiceKey];
  document.getElementById("endTitle").textContent = choice.title;
  document.getElementById("endText").textContent = choice.text;
  const textLink = document.getElementById("textLink");
  const messageBody = encodeURIComponent(choice.sms);
  textLink.href = /iPhone|iPad|iPod/.test(navigator.userAgent) ? `sms:&body=${messageBody}` : `sms:?body=${messageBody}`;
  textLink.textContent = `Text ${yourName} your pick`;
  endOverlay.hidden = false;
  endOpen = true;
  jingle(endJingle);
}
document.getElementById("rechooseButton").addEventListener("click", () => {
  endOverlay.hidden = true;
  endOpen = false;
  Object.assign(player, { col: 12, row: 6, fromCol: 12, fromRow: 6, toCol: 12, toRow: 6, dir: "down", moving: false, progress: 0 });
});

// ---------- World rules ----------
const directionVectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const oppositeDirection = { up: "down", down: "up", left: "right", right: "left" };

function tileAt(col, row) {
  if (row < 0 || row >= mapHeight || col < 0 || col >= mapWidth) return "T";
  return gameMap[row][col];
}
function isWalkable(col, row) {
  const tileCode = tileAt(col, row);
  if (col === ranger.col && row === ranger.row) return false;
  if (col === squirrel.col && row === squirrel.row) return false;
  if (tileCode === "G") return gateOpen;
  return ".,g*BPD".includes(tileCode);
}
function foundCount() { return items.filter(item => item.found).length; }
function progressLine() {
  const count = foundCount();
  return count === 5 ? "That's all five! Head to the treasure chest up the main path." : `${count} of 5 found.`;
}
function collect(item, lines) {
  item.found = true;
  item.onGround = false;
  jingle(pickupJingle);
  say(lines.concat([`${herName} got the ${item.label}!`, progressLine()]));
}

function interact() {
  const [dx, dy] = directionVectors[player.dir];
  const targetCol = player.col + dx, targetRow = player.row + dy;
  const tileCode = tileAt(targetCol, targetRow);

  if (targetCol === ranger.col && targetRow === ranger.row) { talkToRanger(); return; }
  if (targetCol === squirrel.col && targetRow === squirrel.row) { talkToSquirrel(); return; }
  if (tileCode === "S") { say(signTexts[`${targetCol},${targetRow}`] || ["The sign is too faded to read."]); return; }
  if (tileCode === "C") { useChest(); return; }
  if (tileCode === "G" && !gateOpen) { say(["The gate is locked tight.", "Maybe that chest by the path has something to do with it."]); return; }
  if (tileCode === "~") {
    if (player.col === dock.col && player.row === dock.row) startFishing();
    else say(["The pond is calm. A few ducks are floating around.", "That little wooden dock looks like a good fishing spot."]);
    return;
  }
  if (tileCode === "A") { shakeTree(targetCol, targetRow); return; }
  if (tileCode === "*") {
    if (hasFlower) say(["You already have a flower tucked behind your ear."]);
    else if (itemById.acorn.found) say(["The flowers are pretty. You leave them be."]);
    else { hasFlower = true; beep(988, 0.08); say([`${herName} picked a little FLOWER.`]); }
    return;
  }
  if (tileCode === "T") { say(["It's a big old tree. Nothing hidden here."]); return; }
  if (tileCode === "b") { say(["You rustle the bush. Just leaves."]); return; }
  if (tileCode === "R") { say(["It's a rock. A very nice rock, though."]); return; }
}

function talkToRanger() {
  ranger.dir = oppositeDirection[player.dir];
  const remaining = items.filter(item => !item.found);
  const lines = [];
  if (!rangerMet) {
    rangerMet = true;
    lines.push(`Oh, hi! You must be ${herName}.`, `${yourName} asked me to keep an eye out for you.`);
  }
  if (gateOpen) lines.push("The north gate's open now. Go on, pick a path!");
  else if (remaining.length === 0) lines.push("You found all five! The chest is up the main path, right next to the sign.");
  else lines.push(`You've found ${5 - remaining.length} of 5 so far.`, "Here's a tip...", remaining[0].hint);
  say(lines);
}

function useChest() {
  const count = foundCount();
  if (chestOpen) { say(["The chest is empty now. The note is yours to keep."]); return; }
  if (count < 5) {
    const missing = 5 - count;
    say([`It's locked. You still need ${missing} more thing${missing === 1 ? "" : "s"}.`]);
    return;
  }
  jingle(chestJingle);
  say([`${herName} used the KEY. *click*`, "The lid creaks open... there's a note inside!"], () => {
    chestOpen = true;
    showNote(() => {
      jingle(gateJingle);
      say(["*RUMBLE*", "Sounds like the gate to the north just swung open!"], () => { gateOpen = true; });
    });
  });
}

function onArrive() {
  const item = items.find(entry => entry.onGround && !entry.found && entry.col === player.col && entry.row === player.row);
  if (item) {
    collect(item, item.id === "feather" ? ["The bluebird left something behind..."] : ["Something was hiding in the grass!"]);
    return;
  }
  if (player.row <= 7 && !forkIntroShown) {
    forkIntroShown = true;
    say(["Two paths split up ahead.", "West leads to the pond for BIRD WATCHING.", "East leads to the orchard for APPLE PICKING.", "Walk down the one you want for date number three!"]);
    return;
  }
  const tileCode = tileAt(player.col, player.row);
  if (tileCode === "B") say(["Binoculars ready. The birds are singing.", "Bird watching it is!"], () => showEnding("birds"));
  if (tileCode === "P") say(["Rows of trees heavy with apples.", "Apple picking it is!"], () => showEnding("apples"));
}

function shakeTree(col, row) {
  treeShake = { col, row, until: performance.now() + 450 };
  beep(180, 0.08); beep(150, 0.08, 0.08);
  const isSpecial = col === specialAppleTree.col && row === specialAppleTree.row;
  if (isSpecial && !itemById.apple.found) collect(itemById.apple, ["*rustle rustle*", "A big red apple drops right into your hands!"]);
  else if (isSpecial) say(["*rustle rustle*", "No more apples will come loose."]);
  else say(["*rustle rustle*", "A few leaves fall. No apples, though."]);
}

function talkToSquirrel() {
  const acorn = itemById.acorn;
  if (acorn.found) { say(["The squirrel is happily sniffing her new flower."]); return; }
  if (!hasFlower) {
    say(["Chitter chitter!", "(The squirrel is hugging an ACORN and won't let go.)", "(She keeps staring at the flower patches around the park...)"]);
    return;
  }
  hasFlower = false;
  squirrel.hasFlower = true;
  collect(acorn, ["You hold out the flower. The squirrel sniffs it...", "She drops the acorn and grabs the flower!"]);
}

function startFishing() {
  if (itemById.key.found) { say(["You've already fished out the key. The fish look relieved."]); return; }
  say(["You cast your line into the pond...", "Press A the moment the bobber dips!"], () => {
    fishing = { phase: "waiting", biteAt: performance.now() + 1400 + Math.random() * 2600 };
    beep(300, 0.1);
  });
}
function updateFishing(now) {
  if (!fishing) return;
  if (fishing.phase === "waiting" && now >= fishing.biteAt) {
    fishing.phase = "bite";
    fishing.endAt = now + 750;
    jingle([[1200, .05], [1200, .05]]);
  } else if (fishing.phase === "bite" && now > fishing.endAt) {
    fishing = null;
    say(["Too slow! It got away.", "Face the pond and press A to try again."]);
  }
}
function pressFishing() {
  if (fishing.phase === "waiting") {
    fishing = null;
    beep(120, 0.15);
    say(["Too early! The splash scared the fish away.", "Face the pond and press A to try again."]);
    return;
  }
  fishing = null;
  fishCatches++;
  if (fishCatches === 1) {
    jingle([[440, .1], [330, .2]]);
    say(["You reel it in... it's an old boot.", "Not quite what you were after. Try again!"]);
  } else {
    collect(itemById.key, ["You reel it in... something shiny is hooked on the line!"]);
  }
}

function updateBird(now) {
  if (bird.phase === "sitting" && started && Math.abs(player.col - bird.col) + Math.abs(player.row - bird.row) <= 2) {
    bird.phase = "flying";
    bird.startedAt = now;
    itemById.feather.onGround = true;
    jingle([[900, .04], [1100, .04], [900, .04], [1100, .04]]);
  }
  if (bird.phase === "flying" && now - bird.startedAt > 1400) bird.phase = "gone";
}

function showBag() {
  const foundLabels = items.filter(item => item.found).map(item => item.label);
  if (hasFlower) foundLabels.push("a FLOWER (not one of the 5)");
  say([`BAG: ${foundCount()} of 5`, foundLabels.length ? foundLabels.join(", ") : "Nothing yet. Try talking to the ranger!"]);
}

// ---------- Input ----------
const keyDirections = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
const heldKeys = [];
let touchDirection = null;

window.addEventListener("keydown", event => {
  unlockAudio();
  const direction = keyDirections[event.code];
  if (direction) {
    event.preventDefault();
    if (!heldKeys.includes(direction)) heldKeys.push(direction);
    return;
  }
  if (event.repeat) return;
  if (["KeyZ", "Enter", "Space"].includes(event.code)) { event.preventDefault(); pendingA = true; }
  if (["KeyX", "Escape", "Backspace"].includes(event.code)) { event.preventDefault(); pendingB = true; }
});
window.addEventListener("keyup", event => {
  const direction = keyDirections[event.code];
  if (!direction) return;
  const index = heldKeys.indexOf(direction);
  if (index >= 0) heldKeys.splice(index, 1);
});
window.addEventListener("blur", () => { heldKeys.length = 0; touchDirection = null; });

const dpad = document.getElementById("dpad");
let dpadPointerId = null;
function updateTouchDirection(event) {
  const bounds = dpad.getBoundingClientRect();
  const dx = event.clientX - (bounds.left + bounds.width / 2);
  const dy = event.clientY - (bounds.top + bounds.height / 2);
  if (Math.hypot(dx, dy) < 10) touchDirection = null;
  else if (Math.abs(dx) > Math.abs(dy)) touchDirection = dx > 0 ? "right" : "left";
  else touchDirection = dy > 0 ? "down" : "up";
  dpad.dataset.dir = touchDirection || "";
}
dpad.addEventListener("pointerdown", event => {
  event.preventDefault();
  unlockAudio();
  dpadPointerId = event.pointerId;
  try { dpad.setPointerCapture(event.pointerId); } catch (error) {}
  updateTouchDirection(event);
});
dpad.addEventListener("pointermove", event => { if (event.pointerId === dpadPointerId) updateTouchDirection(event); });
["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
  dpad.addEventListener(eventName, event => {
    if (event.pointerId !== dpadPointerId) return;
    dpadPointerId = null;
    touchDirection = null;
    dpad.dataset.dir = "";
  });
});

function wireButton(buttonId, onPress) {
  const button = document.getElementById(buttonId);
  button.addEventListener("pointerdown", event => { event.preventDefault(); unlockAudio(); button.classList.add("pressed"); onPress(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(eventName => button.addEventListener(eventName, () => button.classList.remove("pressed")));
  button.addEventListener("click", event => { if (event.detail === 0) onPress(); });
}
wireButton("buttonA", () => { pendingA = true; });
wireButton("buttonB", () => { pendingB = true; });
document.getElementById("title").addEventListener("click", () => { unlockAudio(); pendingA = true; });
document.getElementById("screen").addEventListener("click", () => { if (dialog) pendingA = true; });

function currentDirection() { return touchDirection || heldKeys[heldKeys.length - 1] || null; }
function canControl() { return started && !dialog && !noteCallback && !endOpen && !fishing; }

function startGame() {
  started = true;
  document.getElementById("title").hidden = true;
  jingle([[392, .1], [523, .1], [659, .2]]);
  say([
    `Hi ${herName}! ${yourName} set up a little adventure for you.`,
    "Five things are hidden around this park, and each one takes a little work to get.",
    "Shake trees, make a trade, go fishing... then open the treasure chest up the main path.",
    "Walk with the D-pad. Press A to talk or check things. Press B to see your bag.",
    "Stuck? The park ranger nearby gives hints. Good luck!"
  ]);
}

// ---------- Update ----------
function update(deltaMs, now) {
  if (pendingA) {
    pendingA = false;
    if (!started) startGame();
    else if (endOpen) {}
    else if (noteCallback) closeNote();
    else if (dialog) advanceDialog();
    else if (fishing) pressFishing();
    else if (!player.moving) interact();
  }
  if (pendingB) {
    pendingB = false;
    if (!started || endOpen) {}
    else if (noteCallback) closeNote();
    else if (dialog) advanceDialog();
    else if (fishing) { fishing = null; say(["You reel the line back in."]); }
    else if (!player.moving) showBag();
  }

  updateDialog(deltaMs);
  updateFishing(now);
  updateBird(now);

  if (player.moving) {
    player.progress += deltaMs / 210;
    if (player.progress >= 1) {
      player.col = player.toCol; player.row = player.toRow;
      player.moving = false; player.progress = 0;
      player.stepCount++;
      player.lastArrive = now;
      onArrive();
    }
  }

  if (!player.moving && canControl()) {
    const heldDirection = currentDirection();
    if (!heldDirection) { player.turnTimer = 0; return; }
    if (heldDirection !== player.dir) {
      player.dir = heldDirection;
      player.turnTimer = now - player.lastArrive < 60 ? 0 : 90;
    }
    if (player.turnTimer > 0) { player.turnTimer -= deltaMs; return; }
    const [dx, dy] = directionVectors[player.dir];
    const targetCol = player.col + dx, targetRow = player.row + dy;
    if (isWalkable(targetCol, targetRow)) {
      Object.assign(player, { moving: true, progress: 0, fromCol: player.col, fromRow: player.row, toCol: targetCol, toRow: targetRow });
    } else if (now - lastBump > 350) {
      lastBump = now;
      beep(110, 0.06, 0, 0.03);
    }
  }
}

// ---------- Draw ----------
function playerPixelPosition() {
  if (!player.moving) return { x: player.col * TILE, y: player.row * TILE };
  return {
    x: (player.fromCol + (player.toCol - player.fromCol) * player.progress) * TILE,
    y: (player.fromRow + (player.toRow - player.fromRow) * player.progress) * TILE
  };
}

function drawTile(tileCode, col, row, x, y, now) {
  let image;
  switch (tileCode) {
    case ",": image = tiles.path; break;
    case "g": image = tiles.tall; break;
    case "*": image = tiles.flowers; break;
    case "~": image = Math.floor(now / 600 + col * 0.5) % 2 ? tiles.water1 : tiles.water0; break;
    case "T": image = tiles.tree; break;
    case "A": image = tiles.appleTree; break;
    case "D": image = tiles.dock; break;
    case "b": image = tiles.bush; break;
    case "R": image = tiles.rock; break;
    case "#": image = tiles.fence; break;
    case "G": image = gateOpen ? tiles.path : tiles.gate; break;
    case "S": image = tiles.sign; break;
    case "C": image = chestOpen ? tiles.chestOpen : tiles.chestClosed; break;
    case "B": case "P": image = tiles.path; break;
    default: image = (col * 7 + row * 13) % 3 === 0 ? tiles.grassB : tiles.grassA;
  }
  let shakeOffset = 0;
  if (treeShake && treeShake.col === col && treeShake.row === row && now < treeShake.until) {
    shakeOffset = Math.floor(now / 60) % 2 ? 1 : -1;
    ctx.drawImage(tiles.grassA, x, y);
  }
  ctx.drawImage(image, x + shakeOffset, y);
  if ((tileCode === "B" || tileCode === "P") && gateOpen) {
    const phase = Math.floor(now / 300) % 2;
    ctx.fillStyle = tileCode === "B" ? "#FFFFFF" : "#FFE27A";
    const sparkleX = x + (phase ? 4 : 10), sparkleY = y + (phase ? 4 : 9);
    ctx.fillRect(sparkleX, sparkleY - 2, 1, 5);
    ctx.fillRect(sparkleX - 2, sparkleY, 5, 1);
  }
  if (tileCode === "C" && !chestOpen && foundCount() === 5 && Math.floor(now / 400) % 2) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x + 13, y + 2, 1, 3); ctx.fillRect(x + 12, y + 3, 3, 1);
  }
}

function drawBird(worldX, worldY, cameraX, cameraY, now, offset) {
  const hop = Math.floor(now / 350 + offset) % 3 === 0 ? 2 : 0;
  const x = worldX - cameraX, y = worldY - cameraY - hop;
  ctx.fillStyle = "#4C7FC0"; ctx.fillRect(x, y + 1, 4, 3);
  ctx.fillStyle = "#3A6399"; ctx.fillRect(x + 4, y, 2, 2);
  ctx.fillStyle = "#E2A83B"; ctx.fillRect(x + 6, y + 1, 1, 1);
  ctx.fillStyle = "#2A4A7A"; ctx.fillRect(x + 1, hop ? y : y + 2, 2, 1);
}

function draw(now) {
  const position = playerPixelPosition();
  const cameraX = Math.max(0, Math.min(mapWidth * TILE - VIEW_W, Math.round(position.x + 8 - VIEW_W / 2)));
  const cameraY = Math.max(0, Math.min(mapHeight * TILE - VIEW_H, Math.round(position.y + 8 - VIEW_H / 2)));

  const firstCol = Math.floor(cameraX / TILE), lastCol = Math.min(mapWidth - 1, Math.floor((cameraX + VIEW_W) / TILE));
  const firstRow = Math.floor(cameraY / TILE), lastRow = Math.min(mapHeight - 1, Math.floor((cameraY + VIEW_H) / TILE));

  for (let row = firstRow; row <= lastRow; row++)
    for (let col = firstCol; col <= lastCol; col++)
      drawTile(gameMap[row][col], col, row, col * TILE - cameraX, row * TILE - cameraY, now);

  drawBird(7 * TILE + 3, 1 * TILE + 8, cameraX, cameraY, now, 0);
  drawBird(10 * TILE + 5, 3 * TILE + 4, cameraX, cameraY, now, 1);
  drawBird(6 * TILE + 8, 4 * TILE + 10, cameraX, cameraY, now, 2);

  if (bird.phase === "sitting") drawBird(bird.col * TILE + 5, bird.row * TILE + 8, cameraX, cameraY, now, 0);
  if (bird.phase === "flying") {
    const flight = (now - bird.startedAt) / 1400;
    const flap = Math.floor(now / 80) % 2;
    const x = Math.round(bird.col * TILE + 5 + flight * 70 - cameraX), y = Math.round(bird.row * TILE + 8 - flight * 90 - cameraY);
    ctx.fillStyle = "#4C7FC0"; ctx.fillRect(x, y + 1, 4, 3);
    ctx.fillStyle = "#3A6399"; ctx.fillRect(x + 4, y, 2, 2);
    ctx.fillStyle = "#2A4A7A"; ctx.fillRect(x - 1, flap ? y - 2 : y + 3, 3, 2); ctx.fillRect(x + 2, flap ? y - 2 : y + 3, 2, 2);
  }

  const squirrelX = squirrel.col * TILE - cameraX, squirrelY = squirrel.row * TILE - cameraY;
  ctx.drawImage(squirrelArt[Math.floor(now / 500) % 2], squirrelX, squirrelY);
  if (squirrel.hasFlower) { ctx.fillStyle = "#E0574F"; ctx.fillRect(squirrelX + 2, squirrelY + 9, 2, 2); ctx.fillStyle = "#FFF3A0"; ctx.fillRect(squirrelX + 2, squirrelY + 9, 1, 1); }

  items.forEach(item => {
    if (item.found || !item.onGround) return;
    const bob = Math.floor(now / 450 + item.col) % 2;
    ctx.drawImage(itemArt[item.id], item.col * TILE - cameraX, item.row * TILE - cameraY - bob);
  });

  const drawables = [
    { sheet: rangerSprites, dir: ranger.dir, frame: 0, x: ranger.col * TILE, y: ranger.row * TILE },
    { sheet: emilySprites, dir: player.dir, frame: player.moving && player.progress > 0.2 && player.progress < 0.75 ? (player.stepCount % 2 ? 2 : 1) : 0, x: position.x, y: position.y }
  ].sort((first, second) => first.y - second.y);
  // Layering in tall grass, bottom to top:
  // grass over items -> character bodies -> grass over the tiles characters stand on -> character heads
  const grassCoverTop = 3;
  function drawGrassCover(col, row, coverTop) {
    if (tileAt(col, row) !== "g") return;
    ctx.drawImage(tiles.tallOverlay, 0, coverTop, 16, 16 - coverTop, col * TILE - cameraX, row * TILE - cameraY + coverTop, 16, 16 - coverTop);
  }
  items.forEach(item => { if (!item.found && item.onGround) drawGrassCover(item.col, item.row, 9); });

  const placedSprites = drawables.map(entity => {
    const sprite = entity.sheet[entity.dir][entity.frame];
    const drawX = Math.round(entity.x - cameraX), tileTop = Math.round(entity.y - cameraY);
    return { sprite, drawX, spriteTop: tileTop + 12 - sprite.height, tileTop, headHeight: sprite.height - 10 };
  });

  placedSprites.forEach(placed => {
    const bodyHeight = placed.sprite.height - placed.headHeight;
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(placed.drawX + 3, placed.tileTop + 13, 10, 2);
    ctx.drawImage(placed.sprite, 0, placed.headHeight, 16, bodyHeight, placed.drawX, placed.spriteTop + placed.headHeight, 16, bodyHeight);
  });

  const occupiedTiles = [[player.col, player.row], [ranger.col, ranger.row]];
  if (player.moving) occupiedTiles.push([player.fromCol, player.fromRow], [player.toCol, player.toRow]);
  occupiedTiles.forEach(([col, row]) => drawGrassCover(col, row, grassCoverTop));

  placedSprites.forEach(placed => {
    ctx.drawImage(placed.sprite, 0, 0, 16, placed.headHeight, placed.drawX, placed.spriteTop, 16, placed.headHeight);
  });

  const leaf = itemById.leaf;
  if (!leaf.found && now % 1800 < 350) {
    const rustleX = leaf.col * TILE - cameraX, rustleY = leaf.row * TILE - cameraY;
    const jiggle = Math.floor(now / 70) % 2 ? 1 : -1;
    ctx.drawImage(tiles.tallOverlay, 0, 9, 16, 7, rustleX + jiggle, rustleY + 9, 16, 7);
    ctx.fillStyle = "#E0762F"; ctx.fillRect(rustleX + 7 + jiggle, rustleY + 3, 2, 2);
  }

  if (fishing) {
    const bobberX = dock.col * TILE - cameraX + 7;
    const biting = fishing.phase === "bite";
    const bobberY = (dock.row + 1) * TILE - cameraY + 6 + (biting ? 3 : Math.floor(now / 400) % 2);
    const handX = Math.round(position.x - cameraX) + 12, handY = Math.round(position.y - cameraY) + 4;
    ctx.fillStyle = "#6B4A33";
    for (let i = 0; i < 5; i++) ctx.fillRect(handX - i, handY + 2 + i, 1, 1);
    ctx.fillStyle = "rgba(255,255,255,.8)";
    for (let t = 0; t <= 1; t += 0.08) ctx.fillRect(Math.round(handX + (bobberX - handX) * t), Math.round(handY + (bobberY - handY) * t), 1, 1);
    ctx.fillStyle = "#C8423B"; ctx.fillRect(bobberX - 1, bobberY - 1, 3, 2);
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bobberX - 1, bobberY + 1, 3, 1);
    if (biting) {
      ctx.fillStyle = "#8CC4EA"; ctx.fillRect(bobberX - 4, bobberY + 2, 2, 1); ctx.fillRect(bobberX + 3, bobberY + 2, 2, 1);
      const bubbleX = Math.round(position.x - cameraX) + 5, bubbleY = Math.round(position.y - cameraY) - 19;
      ctx.fillStyle = "#FFFDF7"; ctx.fillRect(bubbleX, bubbleY, 7, 9);
      ctx.fillStyle = "#C8423B"; ctx.fillRect(bubbleX + 3, bubbleY + 1, 1, 5); ctx.fillRect(bubbleX + 3, bubbleY + 7, 1, 1);
    }
  }

  if (started && !gateOpen) {
    ctx.fillStyle = "rgba(255,253,247,.88)";
    ctx.fillRect(2, 2, 54, 12);
    ctx.fillStyle = "#1E1A22";
    ctx.fillRect(2, 14, 54, 1);
    items.forEach((item, index) => {
      ctx.globalAlpha = item.found ? 1 : 0.22;
      ctx.drawImage(itemArt[item.id], 3 + index * 10, 4, 8, 8);
    });
    ctx.globalAlpha = 1;
  }
}

let previousTime = performance.now();
function loop(now) {
  const deltaMs = Math.min(50, now - previousTime);
  previousTime = now;
  update(deltaMs, now);
  draw(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
