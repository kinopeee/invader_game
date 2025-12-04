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
let maxCombo = 0;
const COMBO_TIMEOUT = 60; // フレーム数

// 画面シェイク
let screenShake = 0;
let shakeIntensity = 0;

// パワーアップ
let powerUps = [];
let activePowerUps = {
    shield: 0,      // シールド残り時間
    rapidFire: 0,   // 連射残り時間
    spread: 0,      // 拡散弾残り時間
    laser: 0        // レーザー残り時間
};

// プレイヤー
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 50,
    width: 50,
    height: 30,
    speed: 5,
    color: '#00ffff',
    shootCooldown: 0,
    invincible: 0
};

// 弾丸配列
let playerBullets = [];
let enemyBullets = [];
let lasers = [];

// 敵配列
let enemies = [];
let enemyRows = 5;
let enemyCols = 10;
const enemySpacing = 60;
let enemyDirection = 1;
let enemySpeed = 1;

// ボス
let boss = null;
let bossAppearLevel = 3; // 何レベルごとにボスが出現

// スペシャルエネミー（UFO）
let specialEnemy = null;
let specialEnemyTimer = 0;

// パーティクルエフェクト
let particles = [];
let explosions = [];
let floatingTexts = [];

// キー入力
const keys = {};
let lastShootTime = 0;

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
    if (activePowerUps.laser > 0) {
        playSound(1200, 0.05, 'sawtooth', 0.15);
    } else if (activePowerUps.spread > 0) {
        playSound(600, 0.08, 'square', 0.15);
    } else {
        playSound(800, 0.1, 'square', 0.2);
    }
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
    playSound(523, 0.1, 'sine', 0.3);
    setTimeout(() => playSound(659, 0.1, 'sine', 0.3), 100);
    setTimeout(() => playSound(784, 0.15, 'sine', 0.3), 200);
}

function playComboSound(combo) {
    const freq = 400 + Math.min(combo * 50, 600);
    playSound(freq, 0.15, 'sine', 0.25);
}

function playBossSound() {
    playSound(80, 0.3, 'sawtooth', 0.5);
    setTimeout(() => playSound(60, 0.4, 'sawtooth', 0.4), 150);
}

// 敵の種類
const ENEMY_TYPES = {
    normal: { health: 1, score: 10, color: 'hsl(0, 100%, 50%)', shootRate: 0.01 },
    fast: { health: 1, score: 15, color: 'hsl(60, 100%, 50%)', shootRate: 0.015, speed: 1.5 },
    tank: { health: 3, score: 30, color: 'hsl(120, 100%, 40%)', shootRate: 0.005, size: 1.2 },
    sniper: { health: 1, score: 20, color: 'hsl(180, 100%, 50%)', shootRate: 0.02, bulletSpeed: 5 },
    zigzag: { health: 1, score: 25, color: 'hsl(280, 100%, 50%)', shootRate: 0.01, zigzag: true }
};

// 敵の初期化
function initEnemies() {
    enemies = [];
    const startX = 100;
    const startY = 50;
    
    // レベルによって敵の構成を変える
    for (let row = 0; row < enemyRows; row++) {
        for (let col = 0; col < enemyCols; col++) {
            let type = 'normal';
            
            // レベルが上がると特殊な敵が増える
            if (level >= 2 && row === 0) {
                type = 'zigzag';
            } else if (level >= 3 && row === 1) {
                type = 'sniper';
            } else if (level >= 4 && row === 2 && col % 3 === 0) {
                type = 'tank';
            } else if (level >= 5 && row === 3 && col % 2 === 0) {
                type = 'fast';
            }
            
            const typeData = ENEMY_TYPES[type];
            const sizeMultiplier = typeData.size || 1;
            
            enemies.push({
                x: startX + col * enemySpacing,
                y: startY + row * 40,
                width: 40 * sizeMultiplier,
                height: 30 * sizeMultiplier,
                color: typeData.color,
                alive: true,
                type: type,
                health: typeData.health,
                maxHealth: typeData.health,
                score: typeData.score,
                shootRate: typeData.shootRate,
                bulletSpeed: typeData.bulletSpeed || 3,
                zigzagPhase: Math.random() * Math.PI * 2,
                originalX: startX + col * enemySpacing
            });
        }
    }
}

// ボスの初期化
function initBoss() {
    const bossHealth = 20 + level * 10;
    boss = {
        x: canvas.width / 2 - 75,
        y: -100,
        targetY: 80,
        width: 150,
        height: 80,
        health: bossHealth,
        maxHealth: bossHealth,
        color: '#ff0066',
        phase: 0,
        phaseTimer: 0,
        attackPattern: 0,
        invincible: 60 // 登場時の無敵時間
    };
    playBossSound();
    createFloatingText(canvas.width / 2, 200, "⚠️ ボス出現！ ⚠️", '#ff0066', 2);
}

// スペシャルエネミーの初期化
function spawnSpecialEnemy() {
    if (specialEnemy === null && Math.random() < 0.002) {
        const fromLeft = Math.random() > 0.5;
        specialEnemy = {
            x: fromLeft ? -50 : canvas.width + 50,
            y: 30,
            width: 50,
            height: 25,
            speed: fromLeft ? 3 : -3,
            color: '#ff00ff',
            score: 100 + level * 50
        };
    }
}

// パワーアップの種類
const POWERUP_TYPES = [
    { type: 'shield', color: '#00ff00', label: '🛡️', duration: 300 },
    { type: 'rapidFire', color: '#ffff00', label: '⚡', duration: 300 },
    { type: 'spread', color: '#ff8800', label: '💥', duration: 300 },
    { type: 'laser', color: '#ff00ff', label: '🔫', duration: 200 },
    { type: 'life', color: '#ff0000', label: '❤️', duration: 0 },
    { type: 'bomb', color: '#00ffff', label: '💣', duration: 0 }
];

// パワーアップのドロップ
function dropPowerUp(x, y) {
    if (Math.random() < 0.15) { // 15%の確率でドロップ
        const powerUpType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        powerUps.push({
            x: x,
            y: y,
            width: 30,
            height: 30,
            ...powerUpType,
            vy: 1.5
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

// フローティングテキストの作成
function createFloatingText(x, y, text, color = '#fff', scale = 1) {
    floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        life: 60,
        maxLife: 60,
        scale: scale
    });
}

// 画面シェイク
function triggerScreenShake(intensity, duration) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
    screenShake = Math.max(screenShake, duration);
}

// コンボ追加
function addCombo() {
    combo++;
    comboTimer = COMBO_TIMEOUT;
    maxCombo = Math.max(maxCombo, combo);
    
    if (combo >= 5) {
        playComboSound(combo);
    }
    
    // コンボボーナス
    if (combo % 10 === 0 && combo > 0) {
        const bonus = combo * 10;
        score += bonus;
        createFloatingText(canvas.width / 2, canvas.height / 2, `🔥 ${combo} COMBO! +${bonus}`, '#ff8800', 1.5);
        triggerScreenShake(3, 10);
    }
}

// プレイヤーの描画
function drawPlayer() {
    ctx.save();
    
    // 無敵時は点滅
    if (player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    // シールドエフェクト
    if (activePowerUps.shield > 0) {
        ctx.strokeStyle = '#00ff00';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    // パワーアップ中は色が変わる
    let playerColor = player.color;
    if (activePowerUps.laser > 0) {
        playerColor = '#ff00ff';
    } else if (activePowerUps.spread > 0) {
        playerColor = '#ff8800';
    } else if (activePowerUps.rapidFire > 0) {
        playerColor = '#ffff00';
    }
    
    ctx.fillStyle = playerColor;
    ctx.shadowBlur = 20;
    ctx.shadowColor = playerColor;
    
    // プレイヤーシップ（三角形）
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    // エンジンエフェクト
    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    const engineFlicker = Math.sin(Date.now() * 0.05) * 3;
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
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        ctx.fillStyle = enemy.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = enemy.color;
        
        // 敵の描画（タイプによって形を変える）
        ctx.beginPath();
        if (enemy.type === 'tank') {
            // タンクは四角
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        } else if (enemy.type === 'zigzag') {
            // ジグザグは三角
            ctx.moveTo(enemy.x + enemy.width / 2, enemy.y);
            ctx.lineTo(enemy.x, enemy.y + enemy.height);
            ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height);
            ctx.closePath();
            ctx.fill();
        } else {
            // 通常は円形
            ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 体力バー（体力が2以上の敵）
        if (enemy.maxHealth > 1) {
            ctx.fillStyle = '#333';
            ctx.fillRect(enemy.x, enemy.y - 8, enemy.width, 5);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(enemy.x, enemy.y - 8, enemy.width * (enemy.health / enemy.maxHealth), 5);
        }
        
        // 装飾
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x + 5, enemy.y + 5, 6, 4);
        ctx.fillRect(enemy.x + enemy.width - 11, enemy.y + 5, 6, 4);
        
        ctx.shadowBlur = 0;
    });
}

// ボスの描画
function drawBoss() {
    if (!boss) return;
    
    ctx.save();
    
    // 無敵時は点滅
    if (boss.invincible > 0 && Math.floor(boss.invincible / 3) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    // ボス本体
    const gradient = ctx.createRadialGradient(
        boss.x + boss.width / 2, boss.y + boss.height / 2, 0,
        boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 2
    );
    gradient.addColorStop(0, '#ff3399');
    gradient.addColorStop(1, '#660033');
    
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff0066';
    
    // ボスの形（六角形風）
    ctx.beginPath();
    ctx.moveTo(boss.x + boss.width * 0.2, boss.y);
    ctx.lineTo(boss.x + boss.width * 0.8, boss.y);
    ctx.lineTo(boss.x + boss.width, boss.y + boss.height * 0.5);
    ctx.lineTo(boss.x + boss.width * 0.8, boss.y + boss.height);
    ctx.lineTo(boss.x + boss.width * 0.2, boss.y + boss.height);
    ctx.lineTo(boss.x, boss.y + boss.height * 0.5);
    ctx.closePath();
    ctx.fill();
    
    // 目
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#ff0';
    ctx.beginPath();
    ctx.arc(boss.x + boss.width * 0.35, boss.y + boss.height * 0.4, 10, 0, Math.PI * 2);
    ctx.arc(boss.x + boss.width * 0.65, boss.y + boss.height * 0.4, 10, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    
    // 体力バー
    const barWidth = 200;
    const barX = canvas.width / 2 - barWidth / 2;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, 10, barWidth, 15);
    ctx.fillStyle = '#ff0066';
    ctx.fillRect(barX, 10, barWidth * (boss.health / boss.maxHealth), 15);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, 10, barWidth, 15);
    
    // ボス名
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`BOSS Lv.${Math.floor(level / bossAppearLevel)}`, canvas.width / 2, 40);
    
    ctx.restore();
}

// スペシャルエネミーの描画
function drawSpecialEnemy() {
    if (!specialEnemy) return;
    
    ctx.fillStyle = specialEnemy.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = specialEnemy.color;
    
    // UFO形状
    ctx.beginPath();
    ctx.ellipse(specialEnemy.x + specialEnemy.width / 2, specialEnemy.y + specialEnemy.height / 2,
                specialEnemy.width / 2, specialEnemy.height / 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(specialEnemy.x + specialEnemy.width / 2, specialEnemy.y + specialEnemy.height / 3, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

// パワーアップの描画
function drawPowerUps() {
    powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = powerUp.color;
        
        // 円形の背景
        ctx.beginPath();
        ctx.arc(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, powerUp.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // アイコン
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerUp.label, powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
        
        ctx.shadowBlur = 0;
    });
}

// 弾丸の描画
function drawBullets() {
    // プレイヤーの弾丸
    playerBullets.forEach(bullet => {
        ctx.fillStyle = bullet.color || '#00ffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = bullet.color || '#00ffff';
        ctx.fillRect(bullet.x, bullet.y, bullet.width || 5, bullet.height || 15);
        ctx.shadowBlur = 0;
    });
    
    // レーザー
    lasers.forEach(laser => {
        ctx.strokeStyle = '#ff00ff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff00ff';
        ctx.lineWidth = laser.width;
        ctx.beginPath();
        ctx.moveTo(laser.x, laser.y);
        ctx.lineTo(laser.x, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
    });
    
    // 敵の弾丸
    enemyBullets.forEach(bullet => {
        ctx.fillStyle = bullet.color || '#ff00ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = bullet.color || '#ff00ff';
        ctx.fillRect(bullet.x, bullet.y, 5, 15);
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

// フローティングテキストの更新
function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 1;
        ft.life--;
        
        if (ft.life <= 0) {
            floatingTexts.splice(i, 1);
            continue;
        }
        
        const alpha = ft.life / ft.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${16 * ft.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }
}

// プレイヤーの移動
function updatePlayer() {
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
    
    // クールダウンとパワーアップタイマーの更新
    if (player.shootCooldown > 0) player.shootCooldown--;
    if (player.invincible > 0) player.invincible--;
    
    // パワーアップタイマーの更新
    Object.keys(activePowerUps).forEach(key => {
        if (activePowerUps[key] > 0) {
            activePowerUps[key]--;
        }
    });
    
    // コンボタイマーの更新
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer <= 0) {
            combo = 0;
        }
    }
}

// プレイヤーの弾丸発射
function shootPlayerBullet() {
    const cooldown = activePowerUps.rapidFire > 0 ? 5 : 15;
    
    if (player.shootCooldown > 0) return;
    player.shootCooldown = cooldown;
    
    if (activePowerUps.laser > 0) {
        // レーザー
        lasers.push({
            x: player.x + player.width / 2,
            y: player.y,
            width: 8,
            life: 10
        });
    } else if (activePowerUps.spread > 0) {
        // 拡散弾
        for (let i = -2; i <= 2; i++) {
            playerBullets.push({
                x: player.x + player.width / 2 - 2.5,
                y: player.y,
                vx: i * 2,
                speed: 7,
                color: '#ff8800'
            });
        }
    } else {
        // 通常弾
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            vx: 0,
            speed: 7,
            color: '#00ffff'
        });
    }
    
    playShootSound();
}

// 敵の弾丸発射
function shootEnemyBullet(enemy) {
    if (Math.random() < enemy.shootRate * (1 + level * 0.1)) {
        enemyBullets.push({
            x: enemy.x + enemy.width / 2 - 2.5,
            y: enemy.y + enemy.height,
            speed: enemy.bulletSpeed
        });
        playEnemyShootSound();
    }
}

// ボスの攻撃
function bossAttack() {
    if (!boss || boss.invincible > 0) return;
    
    boss.phaseTimer++;
    
    // 攻撃パターン
    switch (boss.attackPattern) {
        case 0: // 扇形攻撃
            if (boss.phaseTimer % 30 === 0) {
                for (let i = -3; i <= 3; i++) {
                    enemyBullets.push({
                        x: boss.x + boss.width / 2,
                        y: boss.y + boss.height,
                        speed: 3,
                        vx: i * 1.5,
                        color: '#ff3399'
                    });
                }
                playEnemyShootSound();
            }
            break;
        case 1: // ランダム弾幕
            if (boss.phaseTimer % 10 === 0) {
                enemyBullets.push({
                    x: boss.x + Math.random() * boss.width,
                    y: boss.y + boss.height,
                    speed: 4,
                    vx: (Math.random() - 0.5) * 2,
                    color: '#ff6600'
                });
                playEnemyShootSound();
            }
            break;
        case 2: // 追尾弾
            if (boss.phaseTimer % 60 === 0) {
                const dx = (player.x + player.width / 2) - (boss.x + boss.width / 2);
                const dy = (player.y) - (boss.y + boss.height);
                const dist = Math.sqrt(dx * dx + dy * dy);
                enemyBullets.push({
                    x: boss.x + boss.width / 2,
                    y: boss.y + boss.height,
                    speed: 0,
                    vx: (dx / dist) * 4,
                    vy: (dy / dist) * 4,
                    color: '#00ff00'
                });
                playEnemyShootSound();
            }
            break;
    }
    
    // パターン切り替え
    if (boss.phaseTimer >= 180) {
        boss.phaseTimer = 0;
        boss.attackPattern = (boss.attackPattern + 1) % 3;
    }
}

// 弾丸の更新
function updateBullets() {
    // プレイヤーの弾丸
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        bullet.y -= bullet.speed;
        bullet.x += bullet.vx || 0;
        
        if (bullet.y < 0 || bullet.x < 0 || bullet.x > canvas.width) {
            playerBullets.splice(i, 1);
            continue;
        }
        
        // 敵との衝突判定
        let hit = false;
        for (let j = 0; j < enemies.length; j++) {
            const enemy = enemies[j];
            if (!enemy.alive) continue;
            
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + 5 > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + 15 > enemy.y) {
                
                enemy.health--;
                if (enemy.health <= 0) {
                    enemy.alive = false;
                    const comboBonus = Math.floor(combo / 5);
                    const earnedScore = enemy.score + comboBonus * 5;
                    score += earnedScore;
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                    createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    createFloatingText(enemy.x + enemy.width / 2, enemy.y, `+${earnedScore}`, enemy.color);
                    playExplosionSound();
                    dropPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    addCombo();
                    triggerScreenShake(2, 5);
                } else {
                    createParticles(bullet.x, bullet.y, '#fff', 5);
                }
                
                hit = true;
                break;
            }
        }
        
        // ボスとの衝突
        if (boss && !hit) {
            if (bullet.x < boss.x + boss.width &&
                bullet.x + 5 > boss.x &&
                bullet.y < boss.y + boss.height &&
                bullet.y + 15 > boss.y &&
                boss.invincible <= 0) {
                
                boss.health--;
                createParticles(bullet.x, bullet.y, '#ff0066', 5);
                hit = true;
                
                if (boss.health <= 0) {
                    const bossScore = 500 + level * 100;
                    score += bossScore;
                    createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 100);
                    createFloatingText(boss.x + boss.width / 2, boss.y, `BOSS DEFEATED! +${bossScore}`, '#ff0066', 2);
                    playExplosionSound();
                    triggerScreenShake(10, 30);
                    boss = null;
                }
            }
        }
        
        // スペシャルエネミーとの衝突
        if (specialEnemy && !hit) {
            if (bullet.x < specialEnemy.x + specialEnemy.width &&
                bullet.x + 5 > specialEnemy.x &&
                bullet.y < specialEnemy.y + specialEnemy.height &&
                bullet.y + 15 > specialEnemy.y) {
                
                score += specialEnemy.score;
                createExplosion(specialEnemy.x + specialEnemy.width / 2, specialEnemy.y + specialEnemy.height / 2);
                createFloatingText(specialEnemy.x + specialEnemy.width / 2, specialEnemy.y, `BONUS! +${specialEnemy.score}`, '#ff00ff', 1.5);
                playExplosionSound();
                triggerScreenShake(5, 10);
                specialEnemy = null;
                hit = true;
            }
        }
        
        if (hit) {
            playerBullets.splice(i, 1);
            updateScore();
        }
    }
    
    // レーザーの更新
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        laser.life--;
        
        if (laser.life <= 0) {
            lasers.splice(i, 1);
            continue;
        }
        
        // レーザーの当たり判定
        enemies.forEach(enemy => {
            if (!enemy.alive) return;
            if (laser.x > enemy.x && laser.x < enemy.x + enemy.width &&
                laser.y > enemy.y) {
                enemy.health--;
                if (enemy.health <= 0) {
                    enemy.alive = false;
                    score += enemy.score;
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                    createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    dropPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    addCombo();
                }
            }
        });
        
        // ボスへのレーザー
        if (boss && boss.invincible <= 0) {
            if (laser.x > boss.x && laser.x < boss.x + boss.width &&
                laser.y > boss.y) {
                boss.health -= 0.5;
                createParticles(laser.x, boss.y + boss.height, '#ff0066', 2);
            }
        }
    }
    
    // 敵の弾丸
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.y += bullet.vy || bullet.speed;
        bullet.x += bullet.vx || 0;
        
        if (bullet.y > canvas.height || bullet.x < 0 || bullet.x > canvas.width) {
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // プレイヤーとの衝突判定
        if (bullet.x < player.x + player.width &&
            bullet.x + 5 > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + 15 > player.y &&
            player.invincible <= 0) {
            
            if (activePowerUps.shield > 0) {
                // シールドで防御
                activePowerUps.shield = 0;
                createExplosion(bullet.x, bullet.y, 20);
                playHitSound();
                enemyBullets.splice(i, 1);
            } else {
                enemyBullets.splice(i, 1);
                lives--;
                player.invincible = 120; // 無敵時間
                combo = 0; // コンボリセット
                createExplosion(player.x + player.width / 2, player.y + player.height / 2, 30);
                playHitSound();
                triggerScreenShake(8, 20);
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
        const powerUp = powerUps[i];
        powerUp.y += powerUp.vy;
        
        // 画面外
        if (powerUp.y > canvas.height) {
            powerUps.splice(i, 1);
            continue;
        }
        
        // プレイヤーとの衝突
        if (powerUp.x < player.x + player.width &&
            powerUp.x + powerUp.width > player.x &&
            powerUp.y < player.y + player.height &&
            powerUp.y + powerUp.height > player.y) {
            
            playPowerUpSound();
            
            switch (powerUp.type) {
                case 'shield':
                    activePowerUps.shield = powerUp.duration;
                    createFloatingText(player.x + player.width / 2, player.y - 20, '🛡️ シールド!', '#00ff00');
                    break;
                case 'rapidFire':
                    activePowerUps.rapidFire = powerUp.duration;
                    createFloatingText(player.x + player.width / 2, player.y - 20, '⚡ 連射!', '#ffff00');
                    break;
                case 'spread':
                    activePowerUps.spread = powerUp.duration;
                    createFloatingText(player.x + player.width / 2, player.y - 20, '💥 拡散弾!', '#ff8800');
                    break;
                case 'laser':
                    activePowerUps.laser = powerUp.duration;
                    createFloatingText(player.x + player.width / 2, player.y - 20, '🔫 レーザー!', '#ff00ff');
                    break;
                case 'life':
                    lives = Math.min(lives + 1, 5);
                    createFloatingText(player.x + player.width / 2, player.y - 20, '❤️ +1 UP!', '#ff0000');
                    updateLives();
                    break;
                case 'bomb':
                    // 画面上の全敵にダメージ
                    enemies.forEach(enemy => {
                        if (enemy.alive) {
                            enemy.health--;
                            if (enemy.health <= 0) {
                                enemy.alive = false;
                                score += enemy.score;
                                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                            }
                        }
                    });
                    createFloatingText(canvas.width / 2, canvas.height / 2, '💣 BOMB!', '#00ffff', 2);
                    triggerScreenShake(10, 30);
                    break;
            }
            
            powerUps.splice(i, 1);
        }
    }
}

// 敵の移動
function updateEnemies() {
    let moveDown = false;
    
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        let speedMultiplier = ENEMY_TYPES[enemy.type].speed || 1;
        enemy.x += enemySpeed * enemyDirection * speedMultiplier;
        
        // ジグザグ移動
        if (enemy.type === 'zigzag') {
            enemy.zigzagPhase += 0.1;
            enemy.x = enemy.originalX + Math.sin(enemy.zigzagPhase) * 30;
        }
        
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
                enemy.originalX = enemy.x;
            }
        });
        enemySpeed += 0.1;
    }
}

// ボスの更新
function updateBoss() {
    if (!boss) return;
    
    // 登場アニメーション
    if (boss.y < boss.targetY) {
        boss.y += 2;
    }
    
    // 無敵時間更新
    if (boss.invincible > 0) {
        boss.invincible--;
    }
    
    // 左右移動
    boss.x += Math.sin(Date.now() * 0.002) * 2;
    boss.x = Math.max(0, Math.min(canvas.width - boss.width, boss.x));
    
    // 攻撃
    bossAttack();
}

// スペシャルエネミーの更新
function updateSpecialEnemy() {
    spawnSpecialEnemy();
    
    if (specialEnemy) {
        specialEnemy.x += specialEnemy.speed;
        
        // 画面外
        if (specialEnemy.x < -100 || specialEnemy.x > canvas.width + 100) {
            specialEnemy = null;
        }
    }
}

// スコア更新
function updateScore() {
    document.getElementById('score').textContent = score;
    
    // ハイスコア更新
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('invaderHighScore', highScore);
    }
    document.getElementById('highScore').textContent = highScore;
    
    // すべての敵を倒したら次のレベル
    if (enemies.every(e => !e.alive) && !boss) {
        level++;
        document.getElementById('level').textContent = level;
        enemySpeed = 1 + level * 0.2;
        playLevelUpSound();
        createFloatingText(canvas.width / 2, canvas.height / 2, `🎉 LEVEL ${level}!`, '#ffd700', 2);
        triggerScreenShake(5, 15);
        
        // ボスレベル
        if (level % bossAppearLevel === 0) {
            initBoss();
        } else {
            initEnemies();
        }
    }
}

// 残機更新
function updateLives() {
    document.getElementById('lives').textContent = lives;
}

// コンボ表示
function drawCombo() {
    if (combo >= 3) {
        const alpha = comboTimer / COMBO_TIMEOUT;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff8800';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'right';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff8800';
        ctx.fillText(`${combo} COMBO!`, canvas.width - 20, 40);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

// パワーアップ状態表示
function drawPowerUpStatus() {
    let y = 60;
    const x = canvas.width - 20;
    
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    
    if (activePowerUps.shield > 0) {
        const alpha = activePowerUps.shield < 60 ? (activePowerUps.shield / 60) : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`🛡️ ${Math.ceil(activePowerUps.shield / 60)}s`, x, y);
        y += 20;
    }
    if (activePowerUps.rapidFire > 0) {
        const alpha = activePowerUps.rapidFire < 60 ? (activePowerUps.rapidFire / 60) : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffff00';
        ctx.fillText(`⚡ ${Math.ceil(activePowerUps.rapidFire / 60)}s`, x, y);
        y += 20;
    }
    if (activePowerUps.spread > 0) {
        const alpha = activePowerUps.spread < 60 ? (activePowerUps.spread / 60) : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff8800';
        ctx.fillText(`💥 ${Math.ceil(activePowerUps.spread / 60)}s`, x, y);
        y += 20;
    }
    if (activePowerUps.laser > 0) {
        const alpha = activePowerUps.laser < 60 ? (activePowerUps.laser / 60) : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff00ff';
        ctx.fillText(`🔫 ${Math.ceil(activePowerUps.laser / 60)}s`, x, y);
    }
    
    ctx.globalAlpha = 1;
}

// ゲームオーバー
function gameOver() {
    gameState = 'gameOver';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('maxCombo').textContent = maxCombo;
    document.getElementById('finalLevel').textContent = level;
    
    if (score >= highScore) {
        document.getElementById('newHighScore').classList.remove('hidden');
    } else {
        document.getElementById('newHighScore').classList.add('hidden');
    }
    
    document.getElementById('gameOver').classList.remove('hidden');
}

// ゲームリスタート
function restartGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    combo = 0;
    maxCombo = 0;
    comboTimer = 0;
    enemySpeed = 1;
    playerBullets = [];
    enemyBullets = [];
    lasers = [];
    particles = [];
    explosions = [];
    floatingTexts = [];
    powerUps = [];
    boss = null;
    specialEnemy = null;
    activePowerUps = { shield: 0, rapidFire: 0, spread: 0, laser: 0 };
    player.x = canvas.width / 2 - 25;
    player.invincible = 0;
    player.shootCooldown = 0;
    initEnemies();
    updateScore();
    updateLives();
    document.getElementById('level').textContent = level;
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('startScreen').classList.add('hidden');
}

// ゲームループ
function gameLoop() {
    // 画面シェイク
    ctx.save();
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
        const shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
        ctx.translate(shakeX, shakeY);
        screenShake--;
        if (screenShake <= 0) {
            shakeIntensity = 0;
        }
    }
    
    // キャンバスクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 星空エフェクト（改良版）
    for (let i = 0; i < 100; i++) {
        const x = (i * 37) % canvas.width;
        const y = (i * 53 + Date.now() * 0.05 * (i % 3 + 1)) % canvas.height;
        const brightness = (Math.sin(Date.now() * 0.005 + i) + 1) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + brightness * 0.7})`;
        ctx.fillRect(x, y, i % 2 + 1, i % 2 + 1);
    }
    
    if (gameState === 'playing') {
        updatePlayer();
        updateBullets();
        updateEnemies();
        updateBoss();
        updateSpecialEnemy();
        updatePowerUps();
        updateParticles();
        updateExplosions();
        updateFloatingTexts();
        
        drawPlayer();
        drawEnemies();
        drawBoss();
        drawSpecialEnemy();
        drawBullets();
        drawPowerUps();
        drawCombo();
        drawPowerUpStatus();
        
        // スペースキー長押しで連射
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
    
    if (e.key === ' ') {
        e.preventDefault();
        if (gameState === 'start') {
            gameState = 'playing';
            document.getElementById('startScreen').classList.add('hidden');
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.getElementById('restartBtn').addEventListener('click', restartGame);

// ハイスコア初期表示
document.getElementById('highScore').textContent = highScore;

// ゲーム初期化
initEnemies();
gameLoop();
