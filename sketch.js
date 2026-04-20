const COST_PER_BALL = 500;
let bankroll = 10000;
let ballActive = false;

const board = {
  width: 960,
  height: 760,
  marginX: 60,
  topDropY: 50,
  topPegY: 105,
  pegSpacingX: 72,
  pegSpacingY: 34,
  pegRadius: 6,
  ballRadius: 9,
  gravity: 0.18,
  friction: 0.999,
  bounce: 0.78,
  wallBounce: 0.75,
  sinkLineY: 650,
  bottomY: 708,
  slotCount: 19,

  slotWallHeight: 58,
  slotWallThickness: 6,
  slotWallBounce: 0.7
};

const theme = {
  bg: [17, 24, 39],
  bgHorror: [13, 16, 20],

  peg: [148, 163, 184],
  pegHorror: [104, 108, 116],

  pegStroke: [226, 232, 240],
  pegStrokeHorror: [130, 122, 122],

  wall: [100, 116, 139],
  wallHorror: [82, 74, 74],

  divider: [148, 163, 184],
  dividerHorror: [92, 82, 82],

  dropFill: [56, 189, 248],
  dropFillHorror: [92, 98, 110],

  dropStroke: [125, 211, 252],
  dropStrokeHorror: [110, 96, 96],

  previewBall: [250, 204, 21],
  previewBallHorror: [148, 120, 64],

  ball: [249, 115, 22],
  ballHorror: [154, 84, 52],

  ballStroke: [255, 237, 213],
  ballStrokeHorror: [180, 150, 140]
};

const JUMPSCARE_THRESHOLD = 8102;
const JUMPSCARE_PENALTY = 624;
const FADE_THRESHOLD_1 = 6530;
const FADE_THRESHOLD_2 = 4420;

let jumpscareTriggered = false;
let jumpscareActive = false;
let jumpscareArmed = false;
let horrorLevel = 0;
let payoutCorrupted = false;

let glitchStarted = false;
let glitchUnlocked = false;
let glitchPlaying = false;
let nextRandomGlitchAt = Infinity;

const RANDOM_GLITCH_MIN_DELAY = 8000;
const RANDOM_GLITCH_MAX_DELAY = 18000;
const RANDOM_GLITCH_CHANCE_PER_FRAME = 0.003;

const scareFlags = {
  firstThresholdSeen: false,
  fadeThresholdOneSeen: false,
  fadeThresholdTwoSeen: false
};

const multipliers = [
  5, 4, 2, 1.5, 1, 0.75, 0.5, 0.25, 0.25,
  0,
  0.25,
  0.25, 0.5, 0.75, 1, 1.5, 2, 4, 5
];

// Larger weights = wider slots
const slotWeights = [
  0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.45, 1.6,
  1.75,
  1.6, 1.45, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7
];

let pegs = [];
let slots = [];
let ball = null;

let dropperX = 0;
let dropperDirection = 1;
let dropperSpeed = 4;

function setup() {
  const canvas = createCanvas(board.width, board.height);
  canvas.parent("gameContainer");
  setupBoard();
  dropperX = board.width / 2;
  updateUI();
}

function draw() {
  tryRandomGlitch();
  updateDropper();

  background(currentThemeColor("bg"));

  updateBall();
  drawSlots();
  drawWalls();
  drawSlotWalls();
  drawDropArea();
  drawPegs();
  drawBall();
}

function setupBoard() {
  pegs = [];
  slots = [];

  const totalWidth = board.width - board.marginX * 2;
  const totalWeight = slotWeights.reduce((sum, w) => sum + w, 0);

  let currentX = board.marginX;

  // Build bottom slots
  for (let i = 0; i < board.slotCount; i++) {
    const slotWidth = totalWidth * (slotWeights[i] / totalWeight);

    slots.push({
      x: currentX,
      width: slotWidth,
      multiplier: multipliers[i],
      index: i
    });

    currentX += slotWidth;
  }

  // Standard Plinko triangle:
  // each row adds exactly 1 peg
  const topPegCount = 3;
  const bottomPegCount = board.slotCount - 1; // 18 pegs for 19 slots
  const rowCount = bottomPegCount - topPegCount + 1; // 16 rows

  board.rows = rowCount;

  const leftBound = board.marginX + board.pegRadius + 4;
  const rightBound = board.width - board.marginX - board.pegRadius - 4;
  const maxUsableWidth = rightBound - leftBound;

  for (let row = 0; row < rowCount; row++) {
    const pegCount = topPegCount + row;
    const y = board.topPegY + row * board.pegSpacingY;

    // Make the triangle widen smoothly toward the bottom
    const rowWidth = map(
      pegCount,
      topPegCount,
      bottomPegCount,
      maxUsableWidth * 0.25,
      maxUsableWidth * 1.0
    );

    const spacingX = pegCount > 1 ? rowWidth / (pegCount - 1) : 0;
    const startX = board.width / 2 - rowWidth / 2;

    for (let col = 0; col < pegCount; col++) {
      const x = startX + col * spacingX;

      pegs.push({
        x: constrain(x, leftBound, rightBound),
        y: y
      });
    }
  }
}

function getDisplayedMultiplier(originalMultiplier) {
  if (!payoutCorrupted) return originalMultiplier;

  if (originalMultiplier === 5) return 3;
  if (originalMultiplier === 4) return 2;
  if (originalMultiplier === 2) return 1.75;

  return originalMultiplier;
}

function drawSlotWalls() {
  const wallTop = board.bottomY - board.slotWallHeight;
  const wallBottom = board.bottomY;

  noStroke();
  fill(currentThemeColor("divider"));

  for (let i = 1; i < slots.length; i++) {
    const x = slots[i].x;

    rectMode(CENTER);
    rect(
      x,
      (wallTop + wallBottom) / 2,
      board.slotWallThickness,
      board.slotWallHeight,
      2
    );
  }

  rectMode(CORNER);
}

function drawSlots() {
  textAlign(CENTER, CENTER);
  strokeWeight(2);

  for (let slot of slots) {
    const displayedMultiplier = getDisplayedMultiplier(slot.multiplier);
    const c = getSlotColor(displayedMultiplier);

    fill(red(c), green(c), blue(c), 60);
    stroke(c);
    rect(
      slot.x + 2,
      board.sinkLineY,
      slot.width - 4,
      board.bottomY - board.sinkLineY
    );

    noStroke();
    fill(255);
    textStyle(BOLD);
    textSize(max(10, slot.width * 0.28));

    const centerY =
      board.sinkLineY + (board.bottomY - board.sinkLineY) / 2;

    text(
      `${displayedMultiplier}x`,
      slot.x + slot.width / 2,
      centerY
    );
  }
}

function drawWalls() {
  stroke(currentThemeColor("wall"));
  strokeWeight(4);
  line(board.marginX, 20, board.marginX, board.bottomY);
  line(board.width - board.marginX, 20, board.width - board.marginX, board.bottomY);
}

function updateDropper() {
  if (ballActive || jumpscareActive) return;

  const leftLimit = board.marginX + board.ballRadius;
  const rightLimit = board.width - board.marginX - board.ballRadius;

  dropperX += dropperDirection * dropperSpeed;

  if (dropperX <= leftLimit) {
    dropperX = leftLimit;
    dropperDirection = 1;
  }

  if (dropperX >= rightLimit) {
    dropperX = rightLimit;
    dropperDirection = -1;
  }
}

function drawDropArea() {
  noStroke();
  const fillCol = currentThemeColor("dropFill");
  fill(red(fillCol), green(fillCol), blue(fillCol), 45);
  rect(board.marginX, 20, board.width - board.marginX * 2, 50, 12);

  const strokeCol = currentThemeColor("dropStroke");
  stroke(strokeCol);
  strokeWeight(2);
  noFill();
  rect(board.marginX, 20, board.width - board.marginX * 2, 50, 12);

  noStroke();
  fill(210 - horrorLevel * 70, 210 - horrorLevel * 80, 210 - horrorLevel * 90);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Click to drop the ball", board.width / 2, 45);

  if (!ballActive) {
    fill(currentThemeColor("previewBall"));
    circle(dropperX, board.topDropY, board.ballRadius * 2);

    stroke(currentThemeColor("dropStroke"));
    strokeWeight(1.5);
    line(dropperX, 20, dropperX, 70);
  }
}

function drawPegs() {
  stroke(currentThemeColor("pegStroke"));
  strokeWeight(1.2);
  fill(currentThemeColor("peg"));

  for (let peg of pegs) {
    circle(peg.x, peg.y, board.pegRadius * 2);
  }
}

function drawBall() {
  if (!ball) return;

  fill(currentThemeColor("ball"));
  stroke(currentThemeColor("ballStroke"));
  strokeWeight(2);
  circle(ball.x, ball.y, board.ballRadius * 2);
}

function spawnBallAt(dropX) {
  if (ballActive) {
    setMessage("Only one ball can fall at a time.");
    return;
  }

  if (bankroll < COST_PER_BALL) {
    setMessage("Not enough money for another ball.");
    return;
  }

  const leftLimit = board.marginX + board.ballRadius;
  const rightLimit = board.width - board.marginX - board.ballRadius;
  const clampedX = constrain(dropX, leftLimit, rightLimit);

  bankroll -= COST_PER_BALL;
  updateUI();
  setStatus("Ball in play");
  setMessage(`Dropped ball for $500.`);

  ball = {
    x: clampedX,
    y: board.topDropY + 8,
    vx: 0,
    vy: 1
  };

  ballActive = true;
}

function updateBall() {
  if (!ball) return;

  ball.vy += board.gravity;
  ball.vx *= board.friction;
  ball.vy *= board.friction;

  ball.x += ball.vx;
  ball.y += ball.vy;

  const leftWall = board.marginX + board.ballRadius;
  const rightWall = board.width - board.marginX - board.ballRadius;

  if (ball.x < leftWall) {
    ball.x = leftWall;
    ball.vx *= -board.wallBounce;
  }

  if (ball.x > rightWall) {
    ball.x = rightWall;
    ball.vx *= -board.wallBounce;
  }

  for (let peg of pegs) {
    handlePegCollision(peg);
  }

  handleSlotWallCollisions();

  if (ball.y >= board.bottomY - board.ballRadius) {
    ball.y = board.bottomY - board.ballRadius;
    settleBall();
  }
}

function handleSlotWallCollisions() {
  if (!ball) return;

  const wallTop = board.bottomY - board.slotWallHeight;
  const wallBottom = board.bottomY;
  const halfThickness = board.slotWallThickness / 2;

  if (ball.y + board.ballRadius < wallTop || ball.y - board.ballRadius > wallBottom) {
    return;
  }

  for (let i = 1; i < slots.length; i++) {
    const wallX = slots[i].x;

    const overlapsHorizontally =
      ball.x + board.ballRadius > wallX - halfThickness &&
      ball.x - board.ballRadius < wallX + halfThickness;

    if (overlapsHorizontally) {
      if (ball.x < wallX) {
        ball.x = wallX - halfThickness - board.ballRadius;
      } else {
        ball.x = wallX + halfThickness + board.ballRadius;
      }

      ball.vx *= -board.slotWallBounce;
    }
  }
}

function handlePegCollision(peg) {
  const dx = ball.x - peg.x;
  const dy = ball.y - peg.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minDistance = board.ballRadius + board.pegRadius;

  if (distance < minDistance && distance > 0) {
    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minDistance - distance;

    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx = (ball.vx - 2 * dot * nx) * board.bounce;
    ball.vy = (ball.vy - 2 * dot * ny) * board.bounce;

    ball.vx += (Math.random() - 0.5) * 0.85;
    if (ball.vy < 0.6) ball.vy = 0.6;
  }
}

function settleBall() {
  let landedSlot = slots[0];

  for (let slot of slots) {
    if (ball.x >= slot.x && ball.x < slot.x + slot.width) {
      landedSlot = slot;
      break;
    }
  }

  const actualMultiplier = getDisplayedMultiplier(landedSlot.multiplier);
  const winnings = Math.round(COST_PER_BALL * actualMultiplier);
  bankroll += winnings;

  evaluateScareThresholds();

  updateUI();
  setStatus("Pick a drop point");

  if (winnings > 0) {
    setMessage(
      `Ball landed in ${actualMultiplier}x. Won $${winnings}.`
    );
  } else {
    setMessage(
      `Ball landed in ${actualMultiplier}x. Lost the drop.`
    );
  }

  ball = null;
  ballActive = false;
}

function mousePressed() {
  if (mouseY > 20 && mouseY < 90) {
    if (jumpscareArmed && !jumpscareTriggered && !jumpscareActive) {
      jumpscareArmed = false;
      triggerJumpscare();
      return;
    }

    spawnBallAt(dropperX);
  }
}

function getSlotColor(multiplier) {
  let normalCol;
  let horrorCol;

  if (multiplier === 0) {
    normalCol = [239, 68, 68];
    horrorCol = [90, 22, 28];
  } else if (multiplier >= 5) {
    normalCol = [34, 197, 94];
    horrorCol = [70, 82, 52];
  } else if (multiplier >= 4) {
    normalCol = [132, 204, 22];
    horrorCol = [82, 78, 48];
  } else if (multiplier >= 2) {
    normalCol = [245, 158, 11];
    horrorCol = [95, 72, 42];
  } else if (multiplier >= 1) {
    normalCol = [251, 113, 133];
    horrorCol = [74, 62, 58];
  } else {
    normalCol = [100, 116, 139];
    horrorCol = [58, 62, 70];
  }

  return color(
    lerp(normalCol[0], horrorCol[0], horrorLevel),
    lerp(normalCol[1], horrorCol[1], horrorLevel),
    lerp(normalCol[2], horrorCol[2], horrorLevel)
  );
}

function triggerJumpscare() {
  if (jumpscareTriggered || jumpscareActive) return;

  jumpscareTriggered = true;
  jumpscareActive = true;

  const overlay = document.getElementById("jumpscareOverlay");
  overlay.classList.add("show");

  horrorLevel = 0.65;
  document.body.classList.add("horror");

  bankroll = Math.max(0, bankroll - JUMPSCARE_PENALTY);
  updateUI();
  setMessage(`Something was taken from you. -$${JUMPSCARE_PENALTY}`);

  setTimeout(() => {
    overlay.classList.remove("show");
    jumpscareActive = false;
    setStatus("Pick a drop point");
  }, 700);
}

function updateUI() {
  document.getElementById("bankroll").textContent =
    bankroll.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    });
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function setMessage(text) {
  document.getElementById("message").textContent = text;
}

function blendColorPair(normalArr, horrorArr, amount) {
  return color(
    lerp(normalArr[0], horrorArr[0], amount),
    lerp(normalArr[1], horrorArr[1], amount),
    lerp(normalArr[2], horrorArr[2], amount)
  );
}

function evaluateScareThresholds() {
  if (!scareFlags.firstThresholdSeen && bankroll <= JUMPSCARE_THRESHOLD) {
    scareFlags.firstThresholdSeen = true;
    jumpscareArmed = true;
  }

  if (!scareFlags.fadeThresholdOneSeen && bankroll <= FADE_THRESHOLD_1) {
    scareFlags.fadeThresholdOneSeen = true;
    horrorLevel = max(horrorLevel, 0.45);
    startGlitchEffect();
  }

  if (!scareFlags.fadeThresholdTwoSeen && bankroll <= FADE_THRESHOLD_2) {
    scareFlags.fadeThresholdTwoSeen = true;
    horrorLevel = max(horrorLevel, 0.1);
    document.body.classList.add("horror");
  }
}

function currentThemeColor(key) {
  return blendColorPair(theme[key], theme[key + "Horror"], horrorLevel);
}

function scheduleNextRandomGlitch() {
  nextRandomGlitchAt = millis() + random(RANDOM_GLITCH_MIN_DELAY, RANDOM_GLITCH_MAX_DELAY);
}

function tryRandomGlitch() {
  if (!glitchUnlocked) return;
  if (glitchPlaying) return;
  if (jumpscareActive) return;
  if (millis() < nextRandomGlitchAt) return;

  if (random() < RANDOM_GLITCH_CHANCE_PER_FRAME) {
    startGlitchEffect(true);
  }
}

function startGlitchEffect(isRandomReplay = false) {
  const glitchVideo = document.getElementById("glitchOverlay");
  if (!glitchVideo) return;
  if (glitchPlaying) return;

  // First-ever unlock
  glitchStarted = true;
  glitchUnlocked = true;
  glitchPlaying = true;

  if (!isRandomReplay) {
    payoutCorrupted = true;
  }

  glitchVideo.style.filter = "contrast(1.2) saturate(0.7) brightness(0.9)";
  glitchVideo.classList.add("active");
  glitchVideo.currentTime = 0;
  glitchVideo.play().catch(() => {});

  // Play only the first 1.5 seconds of the clip
  setTimeout(() => {
    glitchVideo.pause();
  }, 1500);

  // Keep the frozen overlay visible for the rest of the effect
  setTimeout(() => {
    glitchVideo.classList.remove("active");
    glitchPlaying = false;

    if (glitchUnlocked) {
      scheduleNextRandomGlitch();
    }
  }, 4000);
}

function stopGlitchEffect() {
  const glitchVideo = document.getElementById("glitchOverlay");
  if (!glitchVideo) return;

  glitchVideo.pause();
  glitchVideo.classList.remove("active");
}