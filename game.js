// ゲームキャンバスとコンテキストの設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// ゲーム状態
let gameState = 'start'; // 'start', 'playing', 'gameOver', 'boss'
let score = 0;
let lives = 3;
let level = 1;
let combo = 0;
let comboTime = 0;
let highScore = localStorage.getItem('highScore') || 0;

// プレイヤー
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 50,
    width: 50,
    height: 30,
    speed: 5,
    color: '#00ffff',
    powerUps: {
        rapidFire: false,
        spreadShot: false,
        shield: false
    },
    powerUpTime: {
        rapidFire: 0,
        spreadShot: 0,
        shield: 0
    },
    lastShotTime: 0,
    shootCooldown: 200 // ミリ秒
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

// パーティクルエフェクト
let particles = [];
let explosions = [];

// パワーアップアイテム
let powerUps = [];

// ボス
let boss = null;
let bossBullets = [];

// 背景星雲
let nebulas = [];
for (let i = 0; i < 3; i++) {
    nebulas.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 200 + 100,
        hue: Math.random() * 360,
        speed: Math.random() * 0.5 + 0.2
    });
}

// キー入力
const keys = {};

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
    // 爆発音（複数の周波数を組み合わせ）
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
    // レベルアップ音（上昇する音）
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            playSound(300 + i * 100, 0.1, 'sine', 0.2);
        }, i * 50);
    }
}

function playPowerUpSound() {
    // パワーアップ音（明るい音）
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            playSound(600 + i * 200, 0.15, 'sine', 0.3);
        }, i * 30);
    }
}

function playBossSound() {
    // ボス出現音（低い音）
    playSound(80, 0.5, 'sawtooth', 0.5);
    setTimeout(() => playSound(60, 0.5, 'sawtooth', 0.5), 200);
}

// BGM（ループ）
let bgmOscillator = null;
let bgmGain = null;
let bgmPlaying = false;

function startBGM() {
    if (bgmPlaying) return;
    bgmPlaying = true;
    
    bgmGain = audioContext.createGain();
    bgmGain.gain.value = 0.1;
    bgmGain.connect(audioContext.destination);
    
    function playBGMNote(freq, time) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(bgmGain);
        
        osc.frequency.value = freq;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.1, audioContext.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.3);
        
        osc.start(audioContext.currentTime + time);
        osc.stop(audioContext.currentTime + time + 0.3);
    }
    
    function loopBGM() {
        if (!bgmPlaying || gameState !== 'playing') return;
        
        const notes = [220, 247, 262, 294, 330, 349, 392];
        const pattern = [0, 2, 4, 2, 0, 2, 4, 2, 0, 2, 4, 6, 4, 2, 0];
        
        pattern.forEach((noteIndex, i) => {
            playBGMNote(notes[noteIndex], i * 0.15);
        });
        
        setTimeout(loopBGM, pattern.length * 150);
    }
    
    loopBGM();
}

function stopBGM() {
    bgmPlaying = false;
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
                alive: true
            });
        }
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

// プレイヤーの描画
function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = player.color;
    
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
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2 - 5, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height + 10);
    ctx.lineTo(player.x + player.width / 2 + 5, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

// 敵の描画
function drawEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        ctx.fillStyle = enemy.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = enemy.color;
        
        // 敵の描画（UFO風）
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 装飾
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x + 5, enemy.y + 5, 10, 5);
        ctx.fillRect(enemy.x + enemy.width - 15, enemy.y + 5, 10, 5);
        
        ctx.shadowBlur = 0;
    });
}

// 弾丸の描画
function drawBullets() {
    // プレイヤーの弾丸
    playerBullets.forEach(bullet => {
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillRect(bullet.x, bullet.y, 5, 15);
        ctx.shadowBlur = 0;
    });
    
    // 敵の弾丸
    enemyBullets.forEach(bullet => {
        ctx.fillStyle = '#ff00ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff00ff';
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

// プレイヤーの移動
function updatePlayer() {
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
    
    // 連続発射（スペースキー長押し）
    if (keys[' '] && gameState === 'playing') {
        shootPlayerBullet();
    }
}

// プレイヤーの弾丸発射
function shootPlayerBullet() {
    const now = Date.now();
    const cooldown = player.powerUps.rapidFire ? 50 : player.shootCooldown;
    
    if (now - player.lastShotTime < cooldown) return;
    player.lastShotTime = now;
    
    if (player.powerUps.spreadShot) {
        // 拡散弾：3方向
        for (let i = -1; i <= 1; i++) {
            playerBullets.push({
                x: player.x + player.width / 2 - 2.5,
                y: player.y,
                speed: 7,
                angle: i * 0.3,
                vx: Math.sin(i * 0.3) * 3
            });
        }
    } else {
        // 通常弾
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            angle: 0,
            vx: 0
        });
    }
    playShootSound();
}

// 敵の弾丸発射
function shootEnemyBullet(enemy) {
    if (Math.random() < 0.01) { // 1%の確率で発射
        enemyBullets.push({
            x: enemy.x + enemy.width / 2 - 2.5,
            y: enemy.y + enemy.height,
            speed: 3
        });
        playEnemyShootSound();
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
                
                // コンボシステム
                combo++;
                comboTime = 300; // 5秒（60fps想定）
                const comboBonus = Math.min(combo * 2, 50); // 最大50ポイント
                score += 10 + comboBonus;
                
                createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                playExplosionSound();
                
                // パワーアップアイテムのドロップ（10%の確率）
                if (Math.random() < 0.1) {
                    const powerUpTypes = ['rapidFire', 'spreadShot', 'shield'];
                    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                    powerUps.push({
                        x: enemy.x + enemy.width / 2,
                        y: enemy.y + enemy.height / 2,
                        width: 20,
                        height: 20,
                        type: type,
                        vy: 2,
                        rotation: 0
                    });
                }
                
                updateScore();
                break;
            }
        }
    }
    
    // 敵の弾丸
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.y += bullet.speed;
        
        if (bullet.y > canvas.height) {
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // プレイヤーとの衝突判定
        if (!player.powerUps.shield && 
            bullet.x < player.x + player.width &&
            bullet.x + 5 > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + 15 > player.y) {
            
            enemyBullets.splice(i, 1);
            lives--;
            createExplosion(player.x + player.width / 2, player.y + player.height / 2, 30);
            playHitSound();
            updateLives();
            
            if (lives <= 0) {
                gameOver();
            }
        }
    }
}

// 敵の移動
function updateEnemies() {
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
        localStorage.setItem('highScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
    
    // コンボタイマー更新
    if (comboTime > 0) {
        comboTime--;
    } else {
        combo = 0;
    }
    
    // すべての敵を倒したら次のレベル
    if (enemies.every(e => !e.alive) && !boss) {
        // ボス戦（3レベルごと）
        if (level % 3 === 0) {
            spawnBoss();
        } else {
            level++;
            document.getElementById('level').textContent = level;
            enemySpeed += 0.5;
            playLevelUpSound();
            initEnemies();
        }
    }
}

// 残機更新
function updateLives() {
    document.getElementById('lives').textContent = lives;
}

// ボスの生成
function spawnBoss() {
    boss = {
        x: canvas.width / 2 - 50,
        y: 50,
        width: 100,
        height: 60,
        health: 50 + level * 10,
        maxHealth: 50 + level * 10,
        speed: 2,
        direction: 1,
        shootTimer: 0,
        color: '#ff0000'
    };
    gameState = 'boss';
    playBossSound();
}

// ボスの描画
function drawBoss() {
    if (!boss) return;
    
    ctx.fillStyle = boss.color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = boss.color;
    
    // ボスの本体
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
    
    // 装飾
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(boss.x + 10, boss.y + 10, 20, 10);
    ctx.fillRect(boss.x + boss.width - 30, boss.y + 10, 20, 10);
    
    // ヘルスバー
    const barWidth = boss.width;
    const barHeight = 5;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(boss.x, boss.y - 10, barWidth, barHeight);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(boss.x, boss.y - 10, barWidth * (boss.health / boss.maxHealth), barHeight);
    
    ctx.shadowBlur = 0;
}

// ボスの更新
function updateBoss() {
    if (!boss) return;
    
    boss.x += boss.speed * boss.direction;
    
    if (boss.x <= 0 || boss.x + boss.width >= canvas.width) {
        boss.direction *= -1;
    }
    
    // ボスの弾丸発射
    boss.shootTimer++;
    if (boss.shootTimer > 60) {
        boss.shootTimer = 0;
        // 3方向に発射
        for (let i = -1; i <= 1; i++) {
            bossBullets.push({
                x: boss.x + boss.width / 2 - 2.5,
                y: boss.y + boss.height,
                speed: 4,
                angle: i * 0.3,
                vx: Math.sin(i * 0.3) * 2
            });
        }
        playEnemyShootSound();
    }
    
    // ボスの弾丸更新
    for (let i = bossBullets.length - 1; i >= 0; i--) {
        const bullet = bossBullets[i];
        bullet.y += bullet.speed;
        bullet.x += bullet.vx;
        
        if (bullet.y > canvas.height || bullet.x < 0 || bullet.x > canvas.width) {
            bossBullets.splice(i, 1);
            continue;
        }
        
        // プレイヤーとの衝突
        if (!player.powerUps.shield &&
            bullet.x < player.x + player.width &&
            bullet.x + 5 > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + 15 > player.y) {
            
            bossBullets.splice(i, 1);
            lives--;
            createExplosion(player.x + player.width / 2, player.y + player.height / 2, 30);
            playHitSound();
            updateLives();
            
            if (lives <= 0) {
                gameOver();
            }
        }
    }
    
    // プレイヤーの弾丸との衝突
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        
        if (bullet.x < boss.x + boss.width &&
            bullet.x + 5 > boss.x &&
            bullet.y < boss.y + boss.height &&
            bullet.y + 15 > boss.y) {
            
            playerBullets.splice(i, 1);
            boss.health--;
            createParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.color, 30);
            playHitSound();
            
            if (boss.health <= 0) {
                // ボス撃破
                score += 500;
                createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 100);
                playExplosionSound();
                boss = null;
                bossBullets = [];
                level++;
                document.getElementById('level').textContent = level;
                enemySpeed += 0.5;
                playLevelUpSound();
                initEnemies();
                gameState = 'playing';
            }
        }
    }
}

// ボスの弾丸描画
function drawBossBullets() {
    bossBullets.forEach(bullet => {
        ctx.fillStyle = '#ff00ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff00ff';
        ctx.fillRect(bullet.x, bullet.y, 5, 15);
        ctx.shadowBlur = 0;
    });
}

// パワーアップアイテムの描画
function drawPowerUps() {
    powerUps.forEach(powerUp => {
        powerUp.rotation += 0.1;
        powerUp.y += powerUp.vy;
        
        ctx.save();
        ctx.translate(powerUp.x, powerUp.y);
        ctx.rotate(powerUp.rotation);
        
        const colors = {
            rapidFire: '#00ff00',
            spreadShot: '#ffff00',
            shield: '#00ffff'
        };
        
        ctx.fillStyle = colors[powerUp.type];
        ctx.shadowBlur = 15;
        ctx.shadowColor = colors[powerUp.type];
        ctx.fillRect(-powerUp.width / 2, -powerUp.height / 2, powerUp.width, powerUp.height);
        
        ctx.shadowBlur = 0;
        ctx.restore();
        
        // プレイヤーとの衝突
        if (powerUp.x < player.x + player.width &&
            powerUp.x + powerUp.width > player.x &&
            powerUp.y < player.y + player.height &&
            powerUp.y + powerUp.height > player.y) {
            
            player.powerUps[powerUp.type] = true;
            player.powerUpTime[powerUp.type] = 600; // 10秒
            playPowerUpSound();
            powerUps = powerUps.filter(p => p !== powerUp);
        }
    });
    
    // 画面外に出たパワーアップを削除
    powerUps = powerUps.filter(p => p.y < canvas.height);
}

// パワーアップの時間更新
function updatePowerUps() {
    Object.keys(player.powerUps).forEach(type => {
        if (player.powerUps[type]) {
            player.powerUpTime[type]--;
            if (player.powerUpTime[type] <= 0) {
                player.powerUps[type] = false;
            }
        }
    });
}

// シールドの描画
function drawShield() {
    if (!player.powerUps.shield) return;
    
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ffff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// ゲームオーバー
function gameOver() {
    gameState = 'gameOver';
    stopBGM();
    document.getElementById('finalScore').textContent = score;
    if (score > parseInt(document.getElementById('highScore').textContent)) {
        document.getElementById('newHighScore').classList.remove('hidden');
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
    comboTime = 0;
    enemySpeed = 1;
    playerBullets = [];
    enemyBullets = [];
    bossBullets = [];
    particles = [];
    explosions = [];
    powerUps = [];
    boss = null;
    player.x = canvas.width / 2 - 25;
    player.powerUps = {
        rapidFire: false,
        spreadShot: false,
        shield: false
    };
    player.powerUpTime = {
        rapidFire: 0,
        spreadShot: 0,
        shield: 0
    };
    initEnemies();
    updateScore();
    updateLives();
    document.getElementById('level').textContent = level;
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('newHighScore').classList.add('hidden');
    startBGM();
}

// 背景の描画
function drawBackground() {
    // 星雲エフェクト
    nebulas.forEach(nebula => {
        nebula.y += nebula.speed;
        if (nebula.y > canvas.height + nebula.radius) {
            nebula.y = -nebula.radius;
            nebula.x = Math.random() * canvas.width;
        }
        
        const gradient = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius);
        gradient.addColorStop(0, `hsla(${nebula.hue}, 70%, 50%, 0.3)`);
        gradient.addColorStop(1, `hsla(${nebula.hue}, 70%, 50%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(nebula.x - nebula.radius, nebula.y - nebula.radius, nebula.radius * 2, nebula.radius * 2);
    });
    
    // 星空エフェクト（強化）
    for (let i = 0; i < 100; i++) {
        const x = (i * 37) % canvas.width;
        const y = (i * 53 + Date.now() * 0.05) % canvas.height;
        const brightness = Math.sin(Date.now() * 0.001 + i) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.fillRect(x, y, 2, 2);
    }
}

// コンボ表示
function drawCombo() {
    if (combo > 1) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 30px Arial';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffff00';
        ctx.fillText(`${combo} COMBO!`, canvas.width / 2 - 80, 50);
        ctx.shadowBlur = 0;
    }
}

// ゲームループ
function gameLoop() {
    // キャンバスクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 背景描画
    drawBackground();
    
    if (gameState === 'playing' || gameState === 'boss') {
        updatePlayer();
        updatePowerUps();
        
        if (gameState === 'boss') {
            updateBoss();
        } else {
            updateBullets();
            updateEnemies();
        }
        
        updateParticles();
        updateExplosions();
        
        drawPlayer();
        drawShield();
        
        if (gameState === 'boss') {
            drawBoss();
            drawBossBullets();
        } else {
            drawEnemies();
            drawBullets();
        }
        
        drawPowerUps();
        drawCombo();
    }
    
    requestAnimationFrame(gameLoop);
}

// イベントリスナー
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === ' ' && gameState === 'playing') {
        e.preventDefault();
        shootPlayerBullet();
    }
    
    if (e.key === ' ' && gameState === 'start') {
        e.preventDefault();
        gameState = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
        startBGM();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.getElementById('restartBtn').addEventListener('click', restartGame);

// ゲーム初期化
initEnemies();
document.getElementById('highScore').textContent = highScore;
gameLoop();
