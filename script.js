const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startOverlay = document.getElementById('start-overlay');
const messageOverlay = document.getElementById('message-overlay');
const messageTitle = document.getElementById('message-title');
const messageBody = document.getElementById('message-body');
const continueButton = document.getElementById('continue-button');
const startButton = document.getElementById('start-button');
const characterGrid = document.getElementById('character-grid');
const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');

let audioCtx;
let messageAction = null;
let isRunning = false;
let hasStarted = false;
let lastTimestamp = 0;
let spawnTimer = 0;
let levelStartScore = 0;

const groundHeight = 90;
const gravity = 2200; // pixels per second^2
const jumpVelocity = -1100; // pixels per second
const obstacleGoalPerLevel = [10, 13, 16];

const characters = [
  {
    id: 'berry',
    name: 'Berry Bounce',
    primary: '#ff7ac2',
    secondary: '#ffe066',
    eye: '#ffffff',
    mouth: '#592349',
  },
  {
    id: 'sunny',
    name: 'Sunny Sprout',
    primary: '#ffd866',
    secondary: '#61d7a4',
    eye: '#ffffff',
    mouth: '#ad5b00',
  },
  {
    id: 'lunar',
    name: 'Lunar Loop',
    primary: '#8e8bff',
    secondary: '#74f0ff',
    eye: '#e9f2ff',
    mouth: '#1d1f54',
  },
];

const levels = [
  {
    name: 'Sunny Meadows',
    skyTop: '#87e0ff',
    skyBottom: '#b7f7ff',
    ground: '#8bd67c',
    hill: '#6cc06f',
    obstacle: '#ffcf6b',
    speed: 240,
    spawnInterval: 1500,
  },
  {
    name: 'Dusk Dunes',
    skyTop: '#ffb680',
    skyBottom: '#ffd9a6',
    ground: '#f9c784',
    hill: '#f5a35c',
    obstacle: '#ff8f66',
    speed: 300,
    spawnInterval: 1250,
  },
  {
    name: 'Starlit Peaks',
    skyTop: '#6a5df5',
    skyBottom: '#92a7ff',
    ground: '#6bd5c1',
    hill: '#469e9a',
    obstacle: '#f572ff',
    speed: 360,
    spawnInterval: 1050,
  },
];

const player = {
  radius: 32,
  x: 130,
  y: canvas.height - groundHeight - 32,
  vy: 0,
  grounded: true,
  hurtTimer: 0,
  character: characters[0],
};

let selectedCharacter = null;
let levelIndex = 0;
let score = 0;
let lives = 3;
let obstacles = [];

function updateHud() {
  levelDisplay.textContent = levelIndex + 1;
  scoreDisplay.textContent = score;
  livesDisplay.textContent = lives;
}

function createCharacterCards() {
  characters.forEach((character) => {
    const button = document.createElement('button');
    button.className = 'character-option';
    button.type = 'button';
    button.setAttribute('role', 'listitem');
    button.dataset.characterId = character.id;

    const visual = document.createElement('div');
    visual.className = 'character-visual';
    visual.style.background = `radial-gradient(circle at 30% 30%, ${character.secondary}, ${character.primary})`;

    const eyeLeft = document.createElement('div');
    const eyeRight = document.createElement('div');
    [eyeLeft, eyeRight].forEach((eye, index) => {
      eye.style.position = 'absolute';
      eye.style.width = '18px';
      eye.style.height = '22px';
      eye.style.background = character.eye;
      eye.style.borderRadius = '50%';
      eye.style.top = '32px';
      eye.style.left = `${index === 0 ? 26 : 52}px`;
      eye.style.boxShadow = 'inset -4px -6px 0 rgba(0, 0, 0, 0.12)';
      const pupil = document.createElement('div');
      pupil.style.width = '8px';
      pupil.style.height = '12px';
      pupil.style.background = '#2c2354';
      pupil.style.borderRadius = '50%';
      pupil.style.position = 'absolute';
      pupil.style.left = '5px';
      pupil.style.top = '6px';
      eye.appendChild(pupil);
    });

    const mouth = document.createElement('div');
    mouth.style.position = 'absolute';
    mouth.style.width = '32px';
    mouth.style.height = '16px';
    mouth.style.borderRadius = '32px';
    mouth.style.background = character.mouth;
    mouth.style.bottom = '22px';
    mouth.style.left = '29px';
    mouth.style.boxShadow = '0 4px 0 rgba(0, 0, 0, 0.1)';

    visual.append(eyeLeft, eyeRight, mouth);

    const name = document.createElement('p');
    name.className = 'character-name';
    name.textContent = character.name;

    button.append(visual, name);
    button.addEventListener('click', () => {
      document.querySelectorAll('.character-option').forEach((el) => el.classList.remove('selected'));
      button.classList.add('selected');
      selectedCharacter = character;
      startButton.disabled = false;
    });

    characterGrid.appendChild(button);
  });
}

createCharacterCards();
updateHud();

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    handleJump();
  }
});

canvas.addEventListener('pointerdown', handleJump);

startButton.addEventListener('click', () => {
  if (!selectedCharacter) return;
  startOverlay.classList.add('hidden');
  startNewRun();
});

continueButton.addEventListener('click', () => {
  messageOverlay.classList.add('hidden');
  if (typeof messageAction === 'function') {
    const action = messageAction;
    messageAction = null;
    action();
  }
});

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playJumpSound() {
  if (!audioCtx) {
    initAudio();
  }
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(620, now);
  osc.frequency.exponentialRampToValueAtTime(280, now + 0.25);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.35);
}

function handleJump() {
  if (!hasStarted || !selectedCharacter || !isRunning) return;
  initAudio();
  if (player.grounded && lives > 0) {
    player.vy = jumpVelocity;
    player.grounded = false;
    playJumpSound();
  }
}

function startNewRun() {
  levelIndex = 0;
  score = 0;
  lives = 3;
  player.character = selectedCharacter;
  resetLevelState();
  hasStarted = true;
  isRunning = true;
  lastTimestamp = performance.now();
}

function resetLevelState() {
  levelStartScore = score;
  obstacles = [];
  spawnTimer = 0;
  player.x = 130;
  player.radius = 32;
  player.y = canvas.height - groundHeight - player.radius;
  player.vy = 0;
  player.grounded = true;
  player.hurtTimer = 0;
  updateHud();
}

function showMessage({ title, body, buttonText, action }) {
  messageTitle.textContent = title;
  messageBody.textContent = body;
  continueButton.textContent = buttonText || 'Continue';
  messageOverlay.classList.remove('hidden');
  messageAction = action;
}

function completeLevel() {
  isRunning = false;
  if (levelIndex < levels.length - 1) {
    showMessage({
      title: `${levels[levelIndex].name} Complete!`,
      body: 'Fantastic bouncing! Get ready for the next level.',
      buttonText: 'Next Level',
      action: () => {
        levelIndex += 1;
        resetLevelState();
        isRunning = true;
      },
    });
  } else {
    showMessage({
      title: 'You Won! 🎉',
      body: 'You bounced through every world with style. Want to play again?',
      buttonText: 'Play Again',
      action: () => {
        startOverlay.classList.remove('hidden');
        startButton.disabled = !selectedCharacter;
        isRunning = false;
        hasStarted = false;
        updateHud();
      },
    });
  }
}

function triggerGameOver() {
  isRunning = false;
  showMessage({
    title: 'Game Over',
    body: 'Your bouncy buddy needs a breather. Try another run?',
    buttonText: 'Try Again',
    action: () => {
      startOverlay.classList.remove('hidden');
      startButton.disabled = !selectedCharacter;
      isRunning = false;
      hasStarted = false;
      updateHud();
    },
  });
}

function spawnObstacle() {
  const currentLevel = levels[levelIndex];
  const width = 40 + Math.random() * 35;
  const height = 40 + Math.random() * 70;
  const wobble = Math.random() * 15;
  obstacles.push({
    x: canvas.width + 10,
    width,
    height,
    wobble,
    passed: false,
  });
}

function update(delta) {
  const currentLevel = levels[levelIndex];

  if (player.hurtTimer > 0) {
    player.hurtTimer -= delta;
  }

  // physics update
  player.vy += gravity * delta;
  player.y += player.vy * delta;

  const groundY = canvas.height - groundHeight - player.radius;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.grounded = true;
  }

  spawnTimer += delta * 1000;
  if (spawnTimer >= currentLevel.spawnInterval) {
    spawnTimer = 0;
    spawnObstacle();
  }

  const speed = currentLevel.speed;
  obstacles.forEach((obstacle) => {
    obstacle.x -= speed * delta;
  });

  // remove off-screen obstacles
  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -50);

  // scoring and collisions
  obstacles.forEach((obstacle) => {
    if (!obstacle.passed && obstacle.x + obstacle.width < player.x - player.radius) {
      obstacle.passed = true;
      score += 1;
      updateHud();
      const scoreThisLevel = score - levelStartScore;
      if (scoreThisLevel >= obstacleGoalPerLevel[levelIndex]) {
        completeLevel();
      }
    }

    if (checkCollision(player, obstacle)) {
      if (player.hurtTimer <= 0) {
        lives -= 1;
        player.hurtTimer = 0.8;
        updateHud();
        if (lives <= 0) {
          triggerGameOver();
        }
      }
    }
  });
}

function checkCollision(circle, rect) {
  const rectY = canvas.height - groundHeight - rect.height;
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const nearestY = Math.max(rectY, Math.min(circle.y, rectY + rect.height));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const distanceSq = dx * dx + dy * dy;
  return distanceSq < circle.radius * circle.radius;
}

function drawBackground(level) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, level.skyTop);
  gradient.addColorStop(1, level.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // whimsical clouds
  drawCloud(120, 80, 60);
  drawCloud(420, 60, 70);
  drawCloud(700, 100, 55);

  // rolling hill
  ctx.fillStyle = level.hill;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - groundHeight - 20);
  ctx.quadraticCurveTo(canvas.width / 2, canvas.height - groundHeight - 120, canvas.width, canvas.height - groundHeight - 30);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  // ground
  ctx.fillStyle = level.ground;
  ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
}

function drawCloud(x, y, size) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.6, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + size * 0.6, y - size * 0.6, size * 0.6, Math.PI, Math.PI * 1.85);
  ctx.arc(x + size * 1.2, y - size * 0.4, size * 0.7, Math.PI * 1.3, Math.PI * 1.85);
  ctx.arc(x + size * 1.6, y, size * 0.6, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawObstacles(level) {
  ctx.fillStyle = level.obstacle;
  obstacles.forEach((obstacle) => {
    const rectY = canvas.height - groundHeight - obstacle.height;
    const wobble = Math.sin((performance.now() / 500) + obstacle.wobble) * 6;
    ctx.save();
    ctx.translate(obstacle.x + obstacle.width / 2, rectY + obstacle.height / 2 + wobble);
    ctx.rotate(Math.sin((performance.now() / 400) + obstacle.wobble) * 0.08);
    ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
    ctx.restore();
  });
}

function drawPlayer() {
  const { character } = player;
  const baseGradient = ctx.createRadialGradient(
    player.x - player.radius * 0.5,
    player.y - player.radius * 0.6,
    player.radius * 0.3,
    player.x,
    player.y,
    player.radius
  );
  baseGradient.addColorStop(0, character.secondary);
  baseGradient.addColorStop(1, character.primary);

  ctx.save();
  ctx.translate(0, Math.sin(performance.now() / 180) * 2);

  // shadow
  const shadowOpacity = player.grounded ? 0.3 : 0.15;
  const groundY = canvas.height - groundHeight + 10;
  ctx.fillStyle = `rgba(54, 28, 69, ${shadowOpacity})`;
  ctx.beginPath();
  ctx.ellipse(player.x, groundY, player.radius * 0.8, player.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = baseGradient;
  ctx.fill();

  // cheek blush
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.ellipse(player.x + 14, player.y + 6, 14, 10, Math.PI / 8, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  const eyeOffsetX = 14;
  const eyeOffsetY = -6;
  ctx.fillStyle = character.eye;
  [1, -1].forEach((direction) => {
    ctx.beginPath();
    ctx.ellipse(player.x + eyeOffsetX * direction, player.y + eyeOffsetY, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c2354';
    ctx.beginPath();
    ctx.ellipse(player.x + eyeOffsetX * direction - 2, player.y + eyeOffsetY + 1, 4.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = character.eye;
    ctx.beginPath();
    ctx.ellipse(player.x + eyeOffsetX * direction - 4, player.y + eyeOffsetY - 3, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = character.eye;
  });

  // mouth
  ctx.fillStyle = character.mouth;
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 14, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y + 10, 12, 0, Math.PI);
  ctx.stroke();

  if (player.hurtTimer > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawLevelBanner(level) {
  ctx.font = 'bold 26px "Fredoka", "Nunito", sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillText(level.name, 24, 42);
}

function draw(delta) {
  const currentLevel = levels[levelIndex];
  drawBackground(currentLevel);
  drawObstacles(currentLevel);
  drawPlayer();
  drawLevelBanner(currentLevel);
}

function gameLoop(timestamp) {
  const delta = (timestamp - lastTimestamp) / 1000 || 0;
  lastTimestamp = timestamp;

  if (isRunning) {
    update(delta);
  }

  if (hasStarted) {
    draw(delta);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
