const COST_PER_BALL = 500;
let bankroll = 10000;
let ballActive = false;

const board = {
  width: 960,
  height: 760,
  marginX: 60,
  topDropY: 50,
  topPegY: 120,
  rows: 11,
  pegSpacingX: 68,
  pegSpacingY: 48,
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

const JUMPSCARE_THRESHOLD = 8102;
let jumpscareTriggered = false;
let jumpscareActive = false;
let jumpscareArmed = false;

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

function setup() {
  const canvas = createCanvas(board.width, board.height);
  canvas.parent("gameContainer");
  setupBoard();
  updateUI();
}

function draw() {
  background(17, 24, 39);

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

  const centerX = board.width / 2;

  for (let row = 0; row < board.rows; row++) {
    const count = 10 + (row % 2);
    const rowWidth = (count - 1) * board.pegSpacingX;
    const startX = centerX - rowWidth / 2;
    const y = board.topPegY + row * board.pegSpacingY;

    for (let col = 0; col < count; col++) {
      pegs.push({
        x: startX + col * board.pegSpacingX,
        y: y
      });
    }
  }
}

function drawSlotWalls() {
  const wallTop = board.bottomY - board.slotWallHeight;
  const wallBottom = board.bottomY;

  noStroke();
  fill(148, 163, 184);

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
    const c = getSlotColor(slot.multiplier);

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
      `${slot.multiplier}x`,
      slot.x + slot.width / 2,
      centerY
    );
  }
}

function drawWalls() {
  stroke(100, 116, 139);
  strokeWeight(4);
  line(board.marginX, 20, board.marginX, board.bottomY);
  line(board.width - board.marginX, 20, board.width - board.marginX, board.bottomY);
}

function drawDropArea() {
  noStroke();
  fill(56, 189, 248, 45);
  rect(board.marginX, 20, board.width - board.marginX * 2, 50, 12);

  stroke(125, 211, 252);
  strokeWeight(2);
  noFill();
  rect(board.marginX, 20, board.width - board.marginX * 2, 50, 12);

  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Click anywhere here to drop the ball", board.width / 2, 45);

  if (!ballActive && mouseY > 20 && mouseY < 70) {
    const leftLimit = board.marginX + board.ballRadius;
    const rightLimit = board.width - board.marginX - board.ballRadius;
    const previewX = constrain(mouseX, leftLimit, rightLimit);

    fill(250, 204, 21);
    circle(previewX, board.topDropY, board.ballRadius * 2);
  }
}

function drawPegs() {
  stroke(226, 232, 240);
  strokeWeight(1.2);
  fill(148, 163, 184);

  for (let peg of pegs) {
    circle(peg.x, peg.y, board.pegRadius * 2);
  }
}

function drawBall() {
  if (!ball) return;

  fill(249, 115, 22);
  stroke(255, 237, 213);
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

 const winnings = Math.round(COST_PER_BALL * landedSlot.multiplier);
  bankroll += winnings;

  if (!jumpscareTriggered && !jumpscareArmed && bankroll <= JUMPSCARE_THRESHOLD) {
    jumpscareArmed = true;
  }

  updateUI();
  setStatus("Pick a drop point");

  if (winnings > 0) {
    setMessage(
      `Ball landed in ${landedSlot.multiplier}x. Won $${winnings}.`
    );
  } else {
    setMessage(
      `Ball landed in ${landedSlot.multiplier}x. Lost the drop.`
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
    }

    spawnBallAt(mouseX);
  }
}

function getSlotColor(multiplier) {
  if (multiplier === 0) return color(239, 68, 68);
  if (multiplier >= 5) return color(34, 197, 94);
  if (multiplier >= 3) return color(132, 204, 22);
  if (multiplier >= 2) return color(245, 158, 11);
  if (multiplier >= 1) return color(251, 113, 133);
  return color(100, 116, 139);
}

function triggerJumpscare() {
  if (jumpscareTriggered || jumpscareActive) return;

  jumpscareTriggered = true;
  jumpscareActive = true;

  const overlay = document.getElementById("jumpscareOverlay");
  overlay.classList.add("show");

  setTimeout(() => {
    overlay.classList.remove("show");
    jumpscareActive = false;
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