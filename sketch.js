// ============================
// SETTINGS (EDIT THESE)
// ============================

// Add your wheel options here
let options = [
  { label: "Slots"},
  { label: "Plinko"},
  { label: "RPS"},
  { label: "Black Jack"},
  { label: "Roulette"},
  { label: "Poker"},
];

// ============================
// INTERNAL VARIABLES
// ============================

let angle = 0;            // Current rotation angle
let spinning = false;     // Is the wheel spinning?
let spinSpeed = 0;        // Current speed
let friction = 0.98;      // Controls slowdown (closer to 1 = longer spin)

let selectedIndex = -1;   // Final selected option

let buttonRadius = 30;   // Radius of the spin button

// ============================
// SETUP
// ============================

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(RADIANS);
  textAlign(CENTER, CENTER);
}

// ============================
// DRAW LOOP
// ============================

function draw() {
  background(240);

  translate(width / 2, height / 2);

  drawBackSpinner();
  drawWheel();

  // Handle spinning logic
  if (spinning) {
    angle += spinSpeed;
    spinSpeed *= friction;

    // Stop when slow enough
    if (spinSpeed < 0.002) {
      spinning = false;
      spinSpeed = 0;
      determineWinner();
    }
  }

  drawPointer();
  drawSpinButton();
}

// ============================
// DRAW THE WHEEL
// ============================

function drawWheel() {
  let sliceAngle = TWO_PI / options.length;

  for (let i = 0; i < options.length; i++) {
    let startAngle = angle + i * sliceAngle;

    // Alternate colors
    fill(i % 2 === 0 ? "#641530" : "#2B2B2B");

    // Draw slice
    arc(0, 0, 400, 400, startAngle, startAngle + sliceAngle, PIE);

    // Draw text
    push();
    rotate(startAngle + sliceAngle / 2);
    fill(0);
    textSize(16);
    text(options[i].label, 120, 0);
    pop();
  }
}

// ============================
// DRAW POINTER (TOP MARKER)
// ============================

function drawPointer() {
  fill(0);
  triangle(-10, -210, 10, -210, 0, -180);
}

function drawBackSpinner(){
    fill(0);
    ellipse(0, 0, 410); 
}

// ============================
// DRAW SPIN BUTTON
// ============================

function drawSpinButton() {
  let d = dist(mouseX, mouseY, width / 2, height / 2);

  // Hover effect
  if (d < buttonRadius) {
    fill("#ffcc00"); // lighter when hovered
  } else {
    fill("#FDB512");
  }

  // Draw circle button
  ellipse(0, 0, buttonRadius * 2);

  // Button text
  fill(0);
  textSize(18);
  text("SPIN", 0, 0);
}

// ============================
// CLICK TO SPIN
// ============================

function mousePressed() {
  let d = dist(mouseX, mouseY, width / 2, height / 2);

  // Only spin if clicking button
  if (d < buttonRadius && !spinning) {
    spinSpeed = random(0.2, 0.4);
    spinning = true;
    selectedIndex = -1;
  }
}

// ============================
// DETERMINE WINNER
// ============================

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function determineWinner() {
  let sliceAngle = TWO_PI / options.length;

  // Normalize angle
  let normalized = angle % TWO_PI;

  // Adjust so pointer is at top
  let index = floor((TWO_PI - normalized) / sliceAngle) % options.length;

  selectedIndex = index;

  let selected = options[index];

  console.log("Selected:", selected.label);

  // ============================
  // OPEN NEW TAB BASED ON RESULT
  // ============================

  if (selected.url) {
    window.open(selected.url, "_blank");
  }
}