// ゲームキャンバスとコンテキストの設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// ゲーム状態
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let lives = 3;
let level = 1;
let highScore = localStorage.getItem('invaderHighScore') || 0;

// コンボシステム
let combo = 0;
let comboTimer = 0;
const COMBO_TIMEOUT = 60; // 60フレーム（約1秒）以内に次の敵を倒さないとリセット

// 画面揺れエフェクト
let screenShake = 0;
let screenShakeIntensity = 0;

// プレイヤー
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 50,
    width: 50,
    height: 30,
    speed: 5,
    baseSpeed: 5,
    color: '#00ffff',
    isShielded: false,
    shieldTime: 0,
    powerUp: null, // 'triple', 'rapid', 'speed'
    powerUpTime: 0
};

// 弾丸配列
let playerBullets = [];
let enemyBullets = [];

// 敵配列
let enemies = [];
const enemyRows = 5;
const enemyCols = 10;
const enemySpacing = 60;
let enemyDirection = 1;
let enemySpeed = 1;

// ボス
let boss = null;
let bossActive = false;

// UFO（ボーナス敵）
let ufo = null;
let ufoSpawnTimer = 0;

// パワーアップアイテム
let powerUps = [];
const POWERUP_TYPES = ['triple', 'rapid', 'speed', 'shield', 'bonus', 'bomb'];
const POWERUP_COLORS = {
    triple: '#ff6b6b',
    rapid: '#4ecdc4',
    speed: '#ffe66d',
    shield: '#95e1d3',
    bonus: '#ffd700',
    bomb: '#ff4500'
};
const POWERUP_LABELS = {
    triple: '3WAY',
    rapid: '連射',
    speed: '加速',
    shield: 'シールド',
    bonus: 'BONUS',
    bomb: 'BOMB'
};

// パーティクルエフェクト
let particles = [];
let explosions = [];
let textEffects = []; // スコア表示用

// キー入力
const keys = {};
let shootCooldown = 0;
const SHOOT_COOLDOWN = 15; // 通常の連射間隔
const RAPID_SHOOT_COOLDOWN = 5; // 連射パワーアップ時

// サウンドエフェクト（Web Audio API）
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine', volume = 0.3) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playShootSound() {
    playSound(800, 0.1, 'square', 0.2);
}

function playExplosionSound() {
    playSound(100, 0.2, 'sawtooth', 0.4);
    setTimeout(() => playSound(50, 0.3, 'sawtooth', 0.3), 50);
}

function playEnemyShootSound() {
    playSound(400, 0.15, 'triangle', 0.15);
}

function playHitSound() {
    playSound(200, 0.1, 'square', 0.3);
}

function playLevelUpSound() {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            playSound(300 + i * 100, 0.1, 'sine', 0.2);
        }, i * 50);
    }
}

function playPowerUpSound() {
    playSound(500, 0.1, 'sine', 0.3);
    setTimeout(() => playSound(700, 0.1, 'sine', 0.3), 50);
    setTimeout(() => playSound(900, 0.2, 'sine', 0.3), 100);
}

function playComboSound(comboLevel) {
    const baseFreq = 400 + Math.min(comboLevel * 50, 400);
    playSound(baseFreq, 0.15, 'sine', 0.25);
}

function playBossSound() {
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            playSound(200 - i * 30, 0.3, 'sawtooth', 0.4);
        }, i * 100);
    }
}

function playUFOSound() {
    playSound(600, 0.1, 'sine', 0.2);
    setTimeout(() => playSound(800, 0.1, 'sine', 0.2), 100);
}

function playBombSound() {
    playSound(50, 0.5, 'sawtooth', 0.5);
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            playSound(100 + Math.random() * 100, 0.2, 'sawtooth', 0.3);
        }, i * 50);
    }
}

// 敵の初期化
function initEnemies() {
    enemies = [];
    const startX = 100;
    const startY = 50;
    
    for (let row = 0; row < enemyRows; row++) {
        for (let col = 0; col < enemyCols; col++) {
            enemies.push({
                x: startX + col * enemySpacing,
                y: startY + row * 40,
                width: 40,
                height: 30,
                color: `hsl(${row * 60}, 100%, 50%)`,
                alive: true,
                points: (enemyRows - row) * 10 // 上の敵ほど高得点
            });
        }
    }
}

// ボスの初期化
function initBoss() {
    boss = {
        x: canvas.width / 2 - 60,
        y: 30,
        width: 120,
        height: 60,
        health: 20 + level * 5,
        maxHealth: 20 + level * 5,
        color: '#ff0066',
        direction: 1,
        shootTimer: 0,
        phase: 1
    };
    bossActive = true;
    playBossSound();
    createTextEffect(canvas.width / 2, canvas.height / 2, 'ボス出現！', '#ff0066', 60);
}

// UFOのスポーン
function spawnUFO() {
    if (!ufo && Math.random() < 0.002 && !bossActive) {
        const direction = Math.random() < 0.5 ? 1 : -1;
        ufo = {
            x: direction === 1 ? -60 : canvas.width,
            y: 25,
            width: 60,
            height: 25,
            speed: 3 * direction,
            points: 100 + Math.floor(Math.random() * 200)
        };
        playUFOSound();
    }
}

// パワーアップアイテムのスポーン
function spawnPowerUp(x, y) {
    if (Math.random() < 0.15) { // 15%の確率でドロップ
        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        powerUps.push({
            x: x,
            y: y,
            width: 30,
            height: 30,
            type: type,
            speed: 2,
            angle: 0
        });
    }
}

// パーティクルの作成
function createParticles(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 30,
            maxLife: 30,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// 爆発エフェクトの作成
function createExplosion(x, y, size = 50) {
    explosions.push({
        x: x,
        y: y,
        size: size,
        maxSize: size * 3,
        life: 20,
        maxLife: 20,
        color: `hsl(${Math.random() * 60}, 100%, 50%)`
    });
}

// テキストエフェクトの作成
function createTextEffect(x, y, text, color, duration = 30) {
    textEffects.push({
        x: x,
        y: y,
        text: text,
        color: color,
        life: duration,
        maxLife: duration,
        vy: -2
    });
}

// 画面揺れを発生させる
function triggerScreenShake(intensity = 10, duration = 10) {
    screenShake = duration;
    screenShakeIntensity = intensity;
}

// プレイヤーの描画
function drawPlayer() {
    ctx.save();
    
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = player.color;
    
    // シールドエフェクト
    if (player.isShielded) {
        ctx.strokeStyle = '#95e1d3';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#95e1d3';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 35, 0, Math.PI * 2);
        ctx.stroke();
        
        // シールドの残り時間を表示
        const shieldRatio = player.shieldTime / 300;
        ctx.fillStyle = `rgba(149, 225, 211, ${0.3 + Math.sin(Date.now() * 0.01) * 0.2})`;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 35, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 20;
    
    // パワーアップ時の色変化
    if (player.powerUp) {
        ctx.fillStyle = POWERUP_COLORS[player.powerUp];
        ctx.shadowColor = POWERUP_COLORS[player.powerUp];
    }
    
    // プレイヤーシップ（三角形）
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    // エンジンエフェクト（アニメーション）
    const engineFlicker = Math.sin(Date.now() * 0.02) * 5;
    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2 - 5, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height + 10 + engineFlicker);
    ctx.lineTo(player.x + player.width / 2 + 5, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

// 敵の描画
function drawEnemies() {
    enemies.forEach((enemy, index) => {
        if (!enemy.alive) return;
        
        ctx.fillStyle = enemy.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = enemy.color;
        
        // 敵のアニメーション
        const wobble = Math.sin(Date.now() * 0.005 + index) * 2;
        
        // 敵の描画（UFO風）
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2 + wobble, enemy.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 目（アニメーション）
        const eyeOffset = Math.sin(Date.now() * 0.003) * 2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x + 8 + eyeOffset, enemy.y + 8 + wobble, 8, 6);
        ctx.fillRect(enemy.x + enemy.width - 16 + eyeOffset, enemy.y + 8 + wobble, 8, 6);
        
        ctx.shadowBlur = 0;
    });
}

// ボスの描画
function drawBoss() {
    if (!boss) return;
    
    ctx.save();
    
    // ボスの色（ダメージに応じて変化）
    const healthRatio = boss.health / boss.maxHealth;
    const hue = 330 + (1 - healthRatio) * 60;
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.shadowBlur = 30;
    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
    
    // ボス本体
    ctx.beginPath();
    ctx.ellipse(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 2, boss.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // ボスの装飾
    ctx.fillStyle = '#fff';
    const eyeAngle = Math.sin(Date.now() * 0.003) * 0.2;
    ctx.beginPath();
    ctx.arc(boss.x + 30, boss.y + 25, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(boss.x + boss.width - 30, boss.y + 25, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // 目の中（プレイヤーを見る）
    const eyeTargetX = (player.x - boss.x) / 100;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(boss.x + 30 + eyeTargetX * 3, boss.y + 25, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(boss.x + boss.width - 30 + eyeTargetX * 3, boss.y + 25, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // HPバー
    ctx.fillStyle = '#333';
    ctx.fillRect(boss.x, boss.y - 15, boss.width, 8);
    ctx.fillStyle = `hsl(${healthRatio * 120}, 100%, 50%)`;
    ctx.fillRect(boss.x, boss.y - 15, boss.width * healthRatio, 8);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(boss.x, boss.y - 15, boss.width, 8);
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

// UFOの描画
function drawUFO() {
    if (!ufo) return;
    
    ctx.save();
    
    // UFOのグラデーション
    const gradient = ctx.createLinearGradient(ufo.x, ufo.y, ufo.x, ufo.y + ufo.height);
    gradient.addColorStop(0, '#ffd700');
    gradient.addColorStop(1, '#ff8c00');
    
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffd700';
    
    // UFO本体
    ctx.beginPath();
    ctx.ellipse(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, ufo.width / 2, ufo.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // UFOのライト
    const lightFlicker = Math.sin(Date.now() * 0.01) > 0;
    if (lightFlicker) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(ufo.x + 15 + i * 15, ufo.y + ufo.height / 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // ポイント表示
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${ufo.points}pt`, ufo.x + ufo.width / 2, ufo.y - 5);
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

// パワーアップの描画
function drawPowerUps() {
    powerUps.forEach(pu => {
        ctx.save();
        
        pu.angle += 0.05;
        
        const color = POWERUP_COLORS[pu.type];
        ctx.fillStyle = color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        
        // パワーアップアイテム（回転する）
        ctx.translate(pu.x + pu.width / 2, pu.y + pu.height / 2);
        ctx.rotate(pu.angle);
        
        // 八角形
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 15 + Math.sin(Date.now() * 0.01 + i) * 3;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        // ラベル
        ctx.rotate(-pu.angle);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(POWERUP_LABELS[pu.type], 0, 0);
        
        ctx.shadowBlur = 0;
        ctx.restore();
    });
}

// 弾丸の描画
function drawBullets() {
    // プレイヤーの弾丸
    playerBullets.forEach(bullet => {
        ctx.fillStyle = bullet.color || '#00ffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = bullet.color || '#00ffff';
        ctx.fillRect(bullet.x, bullet.y, 5, 15);
        ctx.shadowBlur = 0;
    });
    
    // 敵の弾丸
    enemyBullets.forEach(bullet => {
        ctx.fillStyle = bullet.color || '#ff00ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = bullet.color || '#ff00ff';
        
        if (bullet.isBoss) {
            // ボスの弾は大きめ
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, 8, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(bullet.x, bullet.y, 5, 15);
        }
        ctx.shadowBlur = 0;
    });
}

// テキストエフェクトの描画
function drawTextEffects() {
    textEffects.forEach(effect => {
        const alpha = effect.life / effect.maxLife;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = effect.color;
        ctx.fillText(effect.text, effect.x, effect.y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    });
}

// パーティクルの描画と更新
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 5;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }
}

// 爆発エフェクトの描画と更新
function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.life--;
        exp.size += 2;
        
        if (exp.life <= 0 || exp.size > exp.maxSize) {
            explosions.splice(i, 1);
            continue;
        }
        
        const alpha = exp.life / exp.maxLife;
        ctx.strokeStyle = exp.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 20;
        ctx.shadowColor = exp.color;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }
}

// テキストエフェクトの更新
function updateTextEffects() {
    for (let i = textEffects.length - 1; i >= 0; i--) {
        const effect = textEffects[i];
        effect.life--;
        effect.y += effect.vy;
        
        if (effect.life <= 0) {
            textEffects.splice(i, 1);
        }
    }
}

// プレイヤーの移動
function updatePlayer() {
    const currentSpeed = player.powerUp === 'speed' ? player.baseSpeed * 1.8 : player.baseSpeed;
    
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= currentSpeed;
    }
    if (keys['ArrowRight'] && player.x < canvas.width - player.width) {
        player.x += currentSpeed;
    }
    
    // パワーアップタイマー
    if (player.powerUpTime > 0) {
        player.powerUpTime--;
        if (player.powerUpTime <= 0) {
            player.powerUp = null;
        }
    }
    
    // シールドタイマー
    if (player.shieldTime > 0) {
        player.shieldTime--;
        if (player.shieldTime <= 0) {
            player.isShielded = false;
        }
    }
    
    // 射撃クールダウン
    if (shootCooldown > 0) {
        shootCooldown--;
    }
    
    // コンボタイマー
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer <= 0) {
            combo = 0;
        }
    }
}

// プレイヤーの弾丸発射
function shootPlayerBullet() {
    const cooldown = player.powerUp === 'rapid' ? RAPID_SHOOT_COOLDOWN : SHOOT_COOLDOWN;
    if (shootCooldown > 0) return;
    
    shootCooldown = cooldown;
    
    if (player.powerUp === 'triple') {
        // 3way shot
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            vx: 0,
            color: '#ff6b6b'
        });
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            vx: -2,
            color: '#ff6b6b'
        });
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            vx: 2,
            color: '#ff6b6b'
        });
    } else {
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            vx: 0,
            color: player.powerUp === 'rapid' ? '#4ecdc4' : '#00ffff'
        });
    }
    playShootSound();
}

// 敵の弾丸発射
function shootEnemyBullet(enemy) {
    const shootChance = 0.005 + level * 0.002;
    if (Math.random() < shootChance) {
        enemyBullets.push({
            x: enemy.x + enemy.width / 2 - 2.5,
            y: enemy.y + enemy.height,
            speed: 3 + level * 0.3
        });
        playEnemyShootSound();
    }
}

// ボスの弾丸発射
function shootBossBullet() {
    if (!boss) return;
    
    boss.shootTimer++;
    
    if (boss.shootTimer >= 30) {
        boss.shootTimer = 0;
        
        // フェーズに応じた攻撃パターン
        if (boss.phase === 1) {
            // 単発攻撃
            enemyBullets.push({
                x: boss.x + boss.width / 2,
                y: boss.y + boss.height,
                speed: 4,
                isBoss: true,
                color: '#ff0066'
            });
        } else if (boss.phase === 2) {
            // 3way攻撃
            for (let i = -1; i <= 1; i++) {
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height,
                    speed: 4,
                    vx: i * 2,
                    isBoss: true,
                    color: '#ff0066'
                });
            }
        } else {
            // 5way攻撃
            for (let i = -2; i <= 2; i++) {
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height,
                    speed: 4,
                    vx: i * 1.5,
                    isBoss: true,
                    color: '#ff0066'
                });
            }
        }
        playEnemyShootSound();
    }
}

// ボムを発動
function activateBomb() {
    playBombSound();
    triggerScreenShake(20, 30);
    
    // 全ての敵弾を消す
    enemyBullets.forEach(bullet => {
        createParticles(bullet.x, bullet.y, '#ff4500', 5);
    });
    enemyBullets = [];
    
    // 画面上の敵にダメージ
    enemies.forEach(enemy => {
        if (enemy.alive) {
            enemy.alive = false;
            score += enemy.points;
            createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color, 15);
            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 30);
        }
    });
    
    // ボスにダメージ
    if (boss) {
        boss.health -= 5;
        createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 60);
    }
    
    // 全体エフェクト
    createExplosion(canvas.width / 2, canvas.height / 2, 100);
    createTextEffect(canvas.width / 2, canvas.height / 2, 'BOMB!', '#ff4500', 60);
    
    updateScore();
}

// 弾丸の更新
function updateBullets() {
    // プレイヤーの弾丸
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        bullet.y -= bullet.speed;
        bullet.x += (bullet.vx || 0);
        
        if (bullet.y < 0 || bullet.x < 0 || bullet.x > canvas.width) {
            playerBullets.splice(i, 1);
            continue;
        }
        
        // ボスとの衝突判定
        if (boss && 
            bullet.x < boss.x + boss.width &&
            bullet.x + 5 > boss.x &&
            bullet.y < boss.y + boss.height &&
            bullet.y + 15 > boss.y) {
            
            boss.health--;
            playerBullets.splice(i, 1);
            createParticles(bullet.x, bullet.y, '#ff0066', 5);
            playHitSound();
            
            // フェーズ変更
            const healthRatio = boss.health / boss.maxHealth;
            if (healthRatio <= 0.3) boss.phase = 3;
            else if (healthRatio <= 0.6) boss.phase = 2;
            
            if (boss.health <= 0) {
                // ボス撃破
                score += 500 + level * 100;
                createParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ff0066', 50);
                createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 80);
                for (let j = 0; j < 5; j++) {
                    setTimeout(() => {
                        createExplosion(
                            boss.x + Math.random() * boss.width,
                            boss.y + Math.random() * boss.height,
                            40
                        );
                    }, j * 100);
                }
                playExplosionSound();
                triggerScreenShake(15, 30);
                createTextEffect(boss.x + boss.width / 2, boss.y, `+${500 + level * 100}`, '#ffd700', 60);
                boss = null;
                bossActive = false;
                updateScore();
            }
            continue;
        }
        
        // UFOとの衝突判定
        if (ufo &&
            bullet.x < ufo.x + ufo.width &&
            bullet.x + 5 > ufo.x &&
            bullet.y < ufo.y + ufo.height &&
            bullet.y + 15 > ufo.y) {
            
            score += ufo.points;
            createParticles(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, '#ffd700', 30);
            createExplosion(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, 40);
            createTextEffect(ufo.x + ufo.width / 2, ufo.y, `+${ufo.points}`, '#ffd700', 45);
            playExplosionSound();
            playerBullets.splice(i, 1);
            ufo = null;
            updateScore();
            continue;
        }
        
        // 敵との衝突判定
        for (let j = 0; j < enemies.length; j++) {
            const enemy = enemies[j];
            if (!enemy.alive) continue;
            
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + 5 > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + 15 > enemy.y) {
                
                // 敵を倒した
                enemy.alive = false;
                playerBullets.splice(i, 1);
                
                // コンボ処理
                combo++;
                comboTimer = COMBO_TIMEOUT;
                const comboBonus = Math.min(combo, 10);
                const earnedPoints = enemy.points * (1 + comboBonus * 0.1);
                score += Math.floor(earnedPoints);
                
                createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                playExplosionSound();
                
                if (combo > 1) {
                    playComboSound(combo);
                    createTextEffect(
                        enemy.x + enemy.width / 2,
                        enemy.y,
                        `${combo} COMBO! +${Math.floor(earnedPoints)}`,
                        `hsl(${combo * 30}, 100%, 50%)`,
                        45
                    );
                }
                
                // パワーアップをドロップ
                spawnPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                
                triggerScreenShake(3, 5);
                updateScore();
                break;
            }
        }
    }
    
    // 敵の弾丸
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.y += bullet.speed;
        bullet.x += (bullet.vx || 0);
        
        if (bullet.y > canvas.height || bullet.x < 0 || bullet.x > canvas.width) {
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // プレイヤーとの衝突判定
        if (bullet.x < player.x + player.width &&
            bullet.x + 5 > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + 15 > player.y) {
            
            enemyBullets.splice(i, 1);
            
            if (player.isShielded) {
                // シールドで防ぐ
                player.isShielded = false;
                player.shieldTime = 0;
                createParticles(player.x + player.width / 2, player.y, '#95e1d3', 20);
                createTextEffect(player.x + player.width / 2, player.y - 20, 'シールド破壊!', '#95e1d3', 30);
                playHitSound();
            } else {
                lives--;
                combo = 0;
                createExplosion(player.x + player.width / 2, player.y + player.height / 2, 30);
                playHitSound();
                triggerScreenShake(10, 15);
                updateLives();
                
                if (lives <= 0) {
                    gameOver();
                }
            }
        }
    }
}

// パワーアップの更新
function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const pu = powerUps[i];
        pu.y += pu.speed;
        
        if (pu.y > canvas.height) {
            powerUps.splice(i, 1);
            continue;
        }
        
        // プレイヤーとの衝突判定
        if (pu.x < player.x + player.width &&
            pu.x + pu.width > player.x &&
            pu.y < player.y + player.height &&
            pu.y + pu.height > player.y) {
            
            powerUps.splice(i, 1);
            playPowerUpSound();
            
            switch (pu.type) {
                case 'triple':
                    player.powerUp = 'triple';
                    player.powerUpTime = 600; // 10秒
                    createTextEffect(player.x + player.width / 2, player.y - 30, '3WAY SHOT!', '#ff6b6b', 45);
                    break;
                case 'rapid':
                    player.powerUp = 'rapid';
                    player.powerUpTime = 600;
                    createTextEffect(player.x + player.width / 2, player.y - 30, '連射モード!', '#4ecdc4', 45);
                    break;
                case 'speed':
                    player.powerUp = 'speed';
                    player.powerUpTime = 600;
                    createTextEffect(player.x + player.width / 2, player.y - 30, 'スピードUP!', '#ffe66d', 45);
                    break;
                case 'shield':
                    player.isShielded = true;
                    player.shieldTime = 300; // 5秒
                    createTextEffect(player.x + player.width / 2, player.y - 30, 'シールド獲得!', '#95e1d3', 45);
                    break;
                case 'bonus':
                    const bonus = 100 + level * 50;
                    score += bonus;
                    createTextEffect(player.x + player.width / 2, player.y - 30, `+${bonus}ポイント!`, '#ffd700', 45);
                    updateScore();
                    break;
                case 'bomb':
                    activateBomb();
                    break;
            }
        }
    }
}

// UFOの更新
function updateUFO() {
    spawnUFO();
    
    if (ufo) {
        ufo.x += ufo.speed;
        
        if ((ufo.speed > 0 && ufo.x > canvas.width) ||
            (ufo.speed < 0 && ufo.x + ufo.width < 0)) {
            ufo = null;
        }
    }
}

// ボスの更新
function updateBoss() {
    if (!boss) return;
    
    // ボスの移動
    boss.x += 2 * boss.direction;
    
    if (boss.x <= 50 || boss.x + boss.width >= canvas.width - 50) {
        boss.direction *= -1;
    }
    
    // ボスの攻撃
    shootBossBullet();
}

// 敵の移動
function updateEnemies() {
    if (bossActive) {
        updateBoss();
        return;
    }
    
    let moveDown = false;
    
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        enemy.x += enemySpeed * enemyDirection;
        
        if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
            moveDown = true;
        }
        
        // 敵がプレイヤーに到達
        if (enemy.y + enemy.height >= player.y) {
            gameOver();
        }
        
        // 敵が弾丸を発射
        shootEnemyBullet(enemy);
    });
    
    if (moveDown) {
        enemyDirection *= -1;
        enemies.forEach(enemy => {
            if (enemy.alive) {
                enemy.y += 20;
            }
        });
        enemySpeed += 0.1;
    }
}

// スコア更新
function updateScore() {
    document.getElementById('score').textContent = score;
    
    // ハイスコア更新
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('invaderHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
    
    // すべての敵を倒したら次のレベル
    if (enemies.every(e => !e.alive) && !bossActive) {
        level++;
        document.getElementById('level').textContent = level;
        
        // 5レベルごとにボス
        if (level % 5 === 0) {
            setTimeout(() => initBoss(), 500);
        } else {
            enemySpeed = 1 + level * 0.2;
            playLevelUpSound();
            createTextEffect(canvas.width / 2, canvas.height / 2, `レベル ${level}!`, '#00ffff', 60);
            initEnemies();
        }
    }
}

// 残機更新
function updateLives() {
    document.getElementById('lives').textContent = lives;
}

// ゲームオーバー
function gameOver() {
    gameState = 'gameOver';
    
    // ハイスコア更新チェック
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('invaderHighScore', highScore);
    }
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalHighScore').textContent = highScore;
    document.getElementById('gameOver').classList.remove('hidden');
}

// ゲームリスタート
function restartGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    combo = 0;
    comboTimer = 0;
    enemySpeed = 1;
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    explosions = [];
    textEffects = [];
    powerUps = [];
    boss = null;
    bossActive = false;
    ufo = null;
    player.x = canvas.width / 2 - 25;
    player.powerUp = null;
    player.powerUpTime = 0;
    player.isShielded = false;
    player.shieldTime = 0;
    initEnemies();
    updateScore();
    updateLives();
    document.getElementById('level').textContent = level;
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('startScreen').classList.add('hidden');
}

// コンボ表示の描画
function drawCombo() {
    if (combo > 1) {
        ctx.save();
        
        const comboColor = `hsl(${combo * 30}, 100%, 50%)`;
        ctx.fillStyle = comboColor;
        ctx.shadowBlur = 20;
        ctx.shadowColor = comboColor;
        ctx.font = `bold ${24 + combo}px Arial`;
        ctx.textAlign = 'right';
        ctx.fillText(`${combo} COMBO`, canvas.width - 20, 100);
        
        // コンボタイマーバー
        const timerRatio = comboTimer / COMBO_TIMEOUT;
        ctx.fillStyle = '#333';
        ctx.fillRect(canvas.width - 120, 110, 100, 8);
        ctx.fillStyle = comboColor;
        ctx.fillRect(canvas.width - 120, 110, 100 * timerRatio, 8);
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// パワーアップ状態の表示
function drawPowerUpStatus() {
    if (player.powerUp) {
        ctx.save();
        
        const color = POWERUP_COLORS[player.powerUp];
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${POWERUP_LABELS[player.powerUp]}: ${Math.ceil(player.powerUpTime / 60)}秒`, 20, 100);
        
        // タイマーバー
        const timerRatio = player.powerUpTime / 600;
        ctx.fillStyle = '#333';
        ctx.fillRect(20, 110, 100, 8);
        ctx.fillStyle = color;
        ctx.fillRect(20, 110, 100 * timerRatio, 8);
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    
    if (player.isShielded) {
        ctx.save();
        
        ctx.fillStyle = '#95e1d3';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#95e1d3';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`シールド: ${Math.ceil(player.shieldTime / 60)}秒`, 20, 140);
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// ゲームループ
function gameLoop() {
    // 画面揺れの適用
    ctx.save();
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeIntensity;
        const shakeY = (Math.random() - 0.5) * screenShakeIntensity;
        ctx.translate(shakeX, shakeY);
        screenShake--;
    }
    
    // キャンバスクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
    
    // 星空エフェクト（レベルに応じて色変化）
    const starHue = (level * 30) % 360;
    for (let i = 0; i < 80; i++) {
        const x = (i * 37) % canvas.width;
        const y = (i * 53 + Date.now() * 0.05) % canvas.height;
        const brightness = 50 + Math.sin(Date.now() * 0.001 + i) * 50;
        ctx.fillStyle = `hsl(${starHue}, 50%, ${brightness}%)`;
        ctx.fillRect(x, y, Math.random() * 2 + 1, Math.random() * 2 + 1);
    }
    
    // 背景グリッドエフェクト
    ctx.strokeStyle = `hsla(${starHue}, 100%, 50%, 0.1)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }
    
    if (gameState === 'playing') {
        updatePlayer();
        updateBullets();
        updateEnemies();
        updateParticles();
        updateExplosions();
        updateTextEffects();
        updatePowerUps();
        updateUFO();
        
        drawPlayer();
        drawEnemies();
        drawBoss();
        drawUFO();
        drawBullets();
        drawPowerUps();
        drawCombo();
        drawPowerUpStatus();
        drawTextEffects();
        
        // 自動発射（スペースキー長押し対応）
        if (keys[' ']) {
            shootPlayerBullet();
        }
    }
    
    ctx.restore();
    
    requestAnimationFrame(gameLoop);
}

// イベントリスナー
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === ' ' && gameState === 'start') {
        e.preventDefault();
        gameState = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
    }
    
    if (e.key === ' ') {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.getElementById('restartBtn').addEventListener('click', restartGame);

// ゲーム初期化
document.getElementById('highScore').textContent = highScore;
initEnemies();
gameLoop();
