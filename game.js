'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const HUD = {
  score: document.getElementById('score'),
  level: document.getElementById('level'),
  lives: document.getElementById('lives'),
};

const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlaySubtitleEl = document.getElementById('overlaySubtitle');
const overlayButtonEl = document.getElementById('overlayButton');

const keysDown = new Set();

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'Space', ' '].includes(e.code) || ['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD'].includes(e.code)) {
    e.preventDefault();
  }
  keysDown.add(e.code);
});

window.addEventListener('keyup', (e) => {
  keysDown.delete(e.code);
});

function rectsIntersect(a, b) {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

class Player {
  constructor() {
    this.width = 40;
    this.height = 20;
    this.x = (GAME_WIDTH - this.width) / 2;
    this.y = GAME_HEIGHT - this.height - 32;
    this.speed = 260;
    this.color = '#22c55e';
    this.cooldown = 0;
    this.alive = true;
  }

  update(dt) {
    if (!this.alive) return;

    let dir = 0;
    if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) dir -= 1;
    if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) dir += 1;

    this.x += dir * this.speed * dt;
    this.x = Math.max(16, Math.min(GAME_WIDTH - this.width - 16, this.x));

    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }
  }

  canShoot() {
    return this.cooldown <= 0 && this.alive;
  }

  shoot() {
    this.cooldown = 0.32;
    return {
      x: this.x + this.width / 2 - 2,
      y: this.y - 8,
      width: 4,
      height: 10,
      speed: -520,
      color: '#38bdf8',
      from: 'player',
    };
  }

  draw(ctx) {
    if (!this.alive) return;

    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.color;

    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;

    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y);
    ctx.lineTo(x + w, y + h * 0.4);
    ctx.lineTo(x + w * 0.7, y + h);
    ctx.lineTo(x + w * 0.3, y + h);
    ctx.lineTo(x, y + h * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + w * 0.18, y + h * 0.45, w * 0.18, h * 0.25);
    ctx.fillRect(x + w * 0.64, y + h * 0.45, w * 0.18, h * 0.25);

    ctx.restore();
  }
}

class Invader {
  constructor(x, y, rowIndex, colIndex) {
    this.width = 32;
    this.height = 22;
    this.x = x;
    this.y = y;
    this.rowIndex = rowIndex;
    this.colIndex = colIndex;
    this.baseColor = ['#f97316', '#eab308', '#a855f7'][rowIndex % 3];
    this.alive = true;
  }

  update(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  draw(ctx, tick) {
    if (!this.alive) return;

    const pulse = 0.85 + 0.15 * Math.sin(tick * 6 + this.rowIndex * 0.7 + this.colIndex * 0.4);
    const color = this.baseColor;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * pulse;
    ctx.fillStyle = color;

    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;

    ctx.fillRect(x + w * 0.15, y + h * 0.1, w * 0.7, h * 0.2);
    ctx.fillRect(x + w * 0.1, y + h * 0.3, w * 0.8, h * 0.3);
    ctx.fillRect(x + w * 0.2, y + h * 0.6, w * 0.25, h * 0.25);
    ctx.fillRect(x + w * 0.55, y + h * 0.6, w * 0.25, h * 0.25);

    ctx.fillStyle = '#020617';
    ctx.fillRect(x + w * 0.25, y + h * 0.35, w * 0.16, h * 0.16);
    ctx.fillRect(x + w * 0.59, y + h * 0.35, w * 0.16, h * 0.16);

    ctx.restore();
  }
}

class Game {
  constructor() {
    this.reset();
    this.bindEvents();
  }

  reset() {
    this.player = new Player();
    this.invaders = [];
    this.bullets = [];
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.invaderDirection = 1;
    this.invaderSpeed = 26;
    this.invaderStepDown = 8;
    this.invaderShootTimer = 1.6;
    this.state = 'menu';
    this.elapsed = 0;

    this.createInvaders();
    this.updateHud();
    this.showOverlay('Retro Invaders', '矢印キー / A・D で移動、スペースでショット', 'ゲームスタート');
  }

  bindEvents() {
    overlayButtonEl.addEventListener('click', () => {
      if (this.state === 'menu' || this.state === 'gameover') {
        this.startGame();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === ' ') {
        if (this.state === 'menu' || this.state === 'gameover') {
          this.startGame();
        } else if (this.state === 'playing') {
          this.handlePlayerShoot();
        }
      }

      if (e.code === 'KeyP') {
        if (this.state === 'playing') {
          this.state = 'paused';
          this.showOverlay('PAUSE', 'Pキーで再開 / Qでタイトルへ', '再開');
        } else if (this.state === 'paused') {
          this.state = 'playing';
          this.hideOverlay();
        }
      }

      if (e.code === 'KeyQ' && this.state === 'paused') {
        this.reset();
      }
    });
  }

  startGame() {
    this.player = new Player();
    this.invaders = [];
    this.bullets = [];
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.invaderDirection = 1;
    this.invaderSpeed = 30;
    this.invaderStepDown = 10;
    this.invaderShootTimer = 1.4;
    this.state = 'playing';
    this.elapsed = 0;

    this.createInvaders();
    this.updateHud();
    this.hideOverlay();
  }

  nextLevel() {
    this.level += 1;
    this.invaders = [];
    this.bullets = this.bullets.filter((b) => b.from !== 'invader');
    this.invaderDirection = 1;
    this.invaderSpeed += 8;
    this.invaderStepDown += 2;
    this.invaderShootTimer = Math.max(0.6, this.invaderShootTimer - 0.08);

    this.createInvaders();
    this.updateHud();
  }

  createInvaders() {
    const rows = 5;
    const cols = 11;
    const spacingX = 52;
    const spacingY = 40;
    const offsetX = (GAME_WIDTH - (cols - 1) * spacingX) / 2 - 16;
    const offsetY = 70;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * spacingX;
        const y = offsetY + row * spacingY;
        this.invaders.push(new Invader(x, y, row, col));
      }
    }
  }

  handlePlayerShoot() {
    if (this.player.canShoot()) {
      const bullet = this.player.shoot();
      this.bullets.push(bullet);
    }
  }

  update(dt) {
    this.elapsed += dt;

    if (this.state === 'menu') {
      return;
    }

    if (this.state === 'paused') {
      this.drawPauseGlow();
      return;
    }

    if (this.state !== 'playing') {
      return;
    }

    this.player.update(dt);

    if (keysDown.has('Space') || keysDown.has(' ')) {
      if (this.player.canShoot()) {
        this.handlePlayerShoot();
      }
    }

    const invaderBounds = this.getInvaderBounds();
    let moveX = 0;
    let moveY = 0;

    if (invaderBounds) {
      const { left, right } = invaderBounds;
      const speed = this.invaderSpeed + this.level * 4;
      moveX = this.invaderDirection * speed * dt;

      if (
        (this.invaderDirection === 1 && right + moveX > GAME_WIDTH - 40) ||
        (this.invaderDirection === -1 && left + moveX < 40)
      ) {
        this.invaderDirection *= -1;
        moveX = this.invaderDirection * speed * dt;
        moveY = this.invaderStepDown;
      }
    }

    let reachedBottom = false;
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      inv.update(moveX, moveY);
      if (inv.y + inv.height >= this.player.y - 4) {
        reachedBottom = true;
      }
    }

    if (reachedBottom) {
      this.loseLife();
    }

    this.invaderShootTimer -= dt;
    if (this.invaderShootTimer <= 0 && this.invaders.some((i) => i.alive)) {
      this.spawnInvaderShot();
      this.invaderShootTimer = Math.max(0.5, 1.4 - this.level * 0.08);
    }

    for (const b of this.bullets) {
      b.y += b.speed * dt;
    }

    this.bullets = this.bullets.filter((b) => b.y + b.height > 0 && b.y < GAME_HEIGHT + 20);

    this.handleCollisions();

    if (!this.invaders.some((i) => i.alive)) {
      this.nextLevel();
    }
  }

  handleCollisions() {
    for (const bullet of this.bullets) {
      if (bullet.from === 'player') {
        for (const inv of this.invaders) {
          if (!inv.alive) continue;
          if (
            rectsIntersect(
              { x: bullet.x, y: bullet.y, width: bullet.width, height: bullet.height },
              { x: inv.x, y: inv.y, width: inv.width, height: inv.height },
            )
          ) {
            inv.alive = false;
            bullet._dead = true;
            this.score += 10 + (4 - Math.min(4, inv.rowIndex)) * 5 + this.level * 2;
            this.updateHud();
            break;
          }
        }
      } else if (bullet.from === 'invader') {
        if (
          this.player.alive &&
          rectsIntersect(
            { x: bullet.x, y: bullet.y, width: bullet.width, height: bullet.height },
            { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height },
          )
        ) {
          bullet._dead = true;
          this.loseLife();
          break;
        }
      }
    }

    this.bullets = this.bullets.filter((b) => !b._dead);
  }

  loseLife() {
    this.lives -= 1;
    this.updateHud();

    if (this.lives <= 0) {
      this.state = 'gameover';
      this.player.alive = false;
      this.showOverlay('GAME OVER', `SCORE: ${this.score.toString().padStart(5, '0')}`, 'もう一度');
    } else {
      this.player = new Player();
      this.bullets = this.bullets.filter((b) => b.from !== 'invader');
    }
  }

  spawnInvaderShot() {
    const shooters = this.invaders.filter((i) => i.alive);
    if (shooters.length === 0) return;

    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    const bullet = {
      x: shooter.x + shooter.width / 2 - 2,
      y: shooter.y + shooter.height + 2,
      width: 4,
      height: 10,
      speed: 220 + this.level * 12,
      color: '#f97316',
      from: 'invader',
    };
    this.bullets.push(bullet);
  }

  getInvaderBounds() {
    const alive = this.invaders.filter((i) => i.alive);
    if (alive.length === 0) return null;

    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (const inv of alive) {
      left = Math.min(left, inv.x);
      right = Math.max(right, inv.x + inv.width);
      top = Math.min(top, inv.y);
      bottom = Math.max(bottom, inv.y + inv.height);
    }

    return { left, right, top, bottom };
  }

  updateHud() {
    HUD.score.textContent = this.score.toString().padStart(5, '0');
    HUD.level.textContent = this.level.toString();
    HUD.lives.textContent = this.lives.toString();
  }

  showOverlay(title, subtitle, buttonText) {
    overlayTitleEl.textContent = title;
    overlaySubtitleEl.textContent = subtitle;
    overlayButtonEl.textContent = buttonText;
    overlayEl.classList.remove('hidden');
    overlayEl.classList.add('visible');
  }

  hideOverlay() {
    overlayEl.classList.remove('visible');
    overlayEl.classList.add('hidden');
  }

  drawBackground() {
    const gradient = ctx.createRadialGradient(
      GAME_WIDTH / 2,
      GAME_HEIGHT * -0.2,
      0,
      GAME_WIDTH / 2,
      GAME_HEIGHT * 0.6,
      GAME_HEIGHT * 1.2,
    );
    gradient.addColorStop(0, '#020617');
    gradient.addColorStop(0.35, '#020617');
    gradient.addColorStop(1, '#000000');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const starCount = 80;
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < starCount; i++) {
      const x = ((i * 97) % GAME_WIDTH) + ((this.elapsed * 20 + i * 13) % 2);
      const y = (i * 53 + (this.elapsed * 25) * (0.5 + (i % 3) * 0.3)) % GAME_HEIGHT;
      const size = (i % 3) === 0 ? 1.5 : 1;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.elapsed * 2 + i);
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  drawPauseGlow() {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.restore();
  }

  draw() {
    this.drawBackground();

    const tick = this.elapsed;

    this.player.draw(ctx);

    for (const inv of this.invaders) {
      inv.draw(ctx, tick);
    }

    for (const b of this.bullets) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.restore();
    }

    if (this.state === 'menu') {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.restore();
    }

    if (this.state === 'gameover') {
      ctx.save();
      ctx.fillStyle = 'rgba(127, 29, 29, 0.32)';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.restore();
    }
  }
}

const game = new Game();

let lastTime = performance.now();

function gameLoop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  game.update(dt);
  game.draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
