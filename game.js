// ゲームキャンバスとコンテキストの設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// ゲーム状態
let gameState = 'start'; // 'start', 'playing', 'gameOver', 'paused'
let score = 0;
let lives = 3;
let level = 1;
let highScore = parseInt(localStorage.getItem('highScore') || '0');
let combo = 0;
let comboTime = 0;
let lastKillTime = 0;
let isPaused = false;

// プレイヤー
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 50,
    width: 50,
    height: 30,
    speed: 5,
    color: '#00ffff',
    rapidFire: false,
    rapidFireTime: 0,
    spreadShot: false,
    spreadShotTime: 0,
    shield: false,
    shieldTime: 0,
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
let bossActive = false;

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
    playSound(600, 0.2, 'sine', 0.3);
    setTimeout(() => playSound(800, 0.2, 'sine', 0.3), 100);
}

function playComboSound() {
    playSound(500 + combo * 50, 0.15, 'square', 0.2);
}

// 敵の初期化
function initEnemies() {
    enemies = [];
    const startX = 100;
    const startY = 50;
    
    for (let row = 0; row < enemyRows; row++) {
        for (let col = 0; col < enemyCols; col++) {
            const enemyType = row < 2 ? 'fast' : row < 4 ? 'normal' : 'tank';
            enemies.push({
                x: startX + col * enemySpacing,
                y: startY + row * 40,
                width: 40,
                height: 30,
                color: `hsl(${row * 60}, 100%, 50%)`,
                alive: true,
                type: enemyType,
                health: enemyType === 'tank' ? 2 : 1,
                speed: enemyType === 'fast' ? 1.5 : 1,
                points: enemyType === 'fast' ? 20 : enemyType === 'tank' ? 30 : 10
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
    // シールドの描画
    if (player.shield) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
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
        
        // 敵のタイプに応じた描画
        if (enemy.type === 'tank') {
            // タンク型は大きく描画
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(enemy.x + 5, enemy.y + 5, enemy.width - 10, 5);
        } else if (enemy.type === 'fast') {
            // 高速型は小さく描画
            ctx.beginPath();
            ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 通常型（UFO風）
            ctx.beginPath();
            ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 装飾
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x + 5, enemy.y + 5, 10, 5);
        ctx.fillRect(enemy.x + enemy.width - 15, enemy.y + 5, 10, 5);
        
        ctx.shadowBlur = 0;
    });
}

// ボスの描画
function drawBoss() {
    if (!boss || !boss.alive) return;
    
    ctx.fillStyle = boss.color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = boss.color;
    
    // ボスの描画（大型UFO）
    ctx.beginPath();
    ctx.arc(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // ボスの装飾
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(boss.x + 10, boss.y + 10, 20, 10);
    ctx.fillRect(boss.x + boss.width - 30, boss.y + 10, 20, 10);
    
    // ヘルスバー
    const barWidth = boss.width;
    const barHeight = 5;
    const healthPercent = boss.health / boss.maxHealth;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(boss.x, boss.y - 15, barWidth, barHeight);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(boss.x, boss.y - 15, barWidth * healthPercent, barHeight);
    
    ctx.shadowBlur = 0;
}

// パワーアップアイテムの描画
function drawPowerUps() {
    powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = powerUp.color;
        ctx.beginPath();
        ctx.arc(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, powerUp.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // アイコン
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(powerUp.icon, powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2 + 7);
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
}

// プレイヤーの弾丸発射
function shootPlayerBullet() {
    const now = Date.now();
    if (now - player.lastShotTime < player.shootCooldown && !player.rapidFire) {
        return;
    }
    player.lastShotTime = now;
    
    if (player.spreadShot) {
        // 拡散弾
        for (let i = -1; i <= 1; i++) {
            playerBullets.push({
                x: player.x + player.width / 2 - 2.5,
                y: player.y,
                speed: 7,
                angle: i * 0.2
            });
        }
    } else {
        // 通常弾
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            angle: 0
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

// パワーアップアイテムの作成
function createPowerUp(x, y) {
    if (Math.random() < 0.3) { // 30%の確率でドロップ
        const types = ['rapid', 'spread', 'shield'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = { rapid: '#00ff00', spread: '#ffff00', shield: '#00ffff' };
        const icons = { rapid: '⚡', spread: '💥', shield: '🛡' };
        
        powerUps.push({
            x: x,
            y: y,
            width: 30,
            height: 30,
            speed: 2,
            type: type,
            color: colors[type],
            icon: icons[type]
        });
    }
}

// パワーアップアイテムの更新
function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.y += powerUp.speed;
        
        if (powerUp.y > canvas.height) {
            powerUps.splice(i, 1);
            continue;
        }
        
        // プレイヤーとの衝突判定
        if (powerUp.x < player.x + player.width &&
            powerUp.x + powerUp.width > player.x &&
            powerUp.y < player.y + player.height &&
            powerUp.y + powerUp.height > player.y) {
            
            powerUps.splice(i, 1);
            playPowerUpSound();
            
            if (powerUp.type === 'rapid') {
                player.rapidFire = true;
                player.rapidFireTime = Date.now() + 10000; // 10秒
                player.shootCooldown = 50;
            } else if (powerUp.type === 'spread') {
                player.spreadShot = true;
                player.spreadShotTime = Date.now() + 10000; // 10秒
            } else if (powerUp.type === 'shield') {
                player.shield = true;
                player.shieldTime = Date.now() + 10000; // 10秒
            }
        }
    }
}

// 弾丸の更新
function updateBullets() {
    // プレイヤーの弾丸
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        bullet.y -= bullet.speed * Math.cos(bullet.angle || 0);
        bullet.x += bullet.speed * Math.sin(bullet.angle || 0);
        
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
                
                // 敵にダメージ
                enemy.health--;
                playerBullets.splice(i, 1);
                
                if (enemy.health <= 0) {
                    // 敵を倒した
                    enemy.alive = false;
                    
                    // コンボシステム
                    const now = Date.now();
                    if (now - lastKillTime < 2000) {
                        combo++;
                        comboTime = now + 2000;
                    } else {
                        combo = 1;
                        comboTime = now + 2000;
                    }
                    lastKillTime = now;
                    
                    // スコア計算（コンボボーナス付き）
                    const baseScore = enemy.points;
                    const comboBonus = Math.min(combo * 5, 100);
                    const totalScore = baseScore + comboBonus;
                    score += totalScore;
                    
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                    createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    playExplosionSound();
                    
                    // パワーアップドロップ
                    createPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    
                    updateScore();
                } else {
                    // ダメージを受けたが倒せなかった
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color, 5);
                }
                break;
            }
        }
        
        // ボスとの衝突判定
        if (boss && boss.alive) {
            if (bullet.x < boss.x + boss.width &&
                bullet.x + 5 > boss.x &&
                bullet.y < boss.y + boss.height &&
                bullet.y + 15 > boss.y) {
                
                boss.health--;
                playerBullets.splice(i, 1);
                createParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.color, 10);
                
                if (boss.health <= 0) {
                    boss.alive = false;
                    score += 500;
                    createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 100);
                    playExplosionSound();
                    bossActive = false;
                    updateScore();
                }
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
        if (bullet.x < player.x + player.width &&
            bullet.x + 5 > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + 15 > player.y) {
            
            enemyBullets.splice(i, 1);
            
            if (player.shield) {
                // シールドで防いだ
                createParticles(player.x + player.width / 2, player.y + player.height / 2, '#00ffff', 10);
            } else {
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
}

// 敵の移動
function updateEnemies() {
    let moveDown = false;
    
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        const speed = enemySpeed * enemy.speed;
        enemy.x += speed * enemyDirection;
        
        if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
            moveDown = true;
        }
        
        // 敵がプレイヤーに到達
        if (enemy.y + enemy.height >= player.y) {
            gameOver();
        }
        
        // 敵が弾丸を発射
        const shootChance = enemy.type === 'fast' ? 0.015 : enemy.type === 'tank' ? 0.02 : 0.01;
        if (Math.random() < shootChance) {
            shootEnemyBullet(enemy);
        }
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

// ボスの初期化
function initBoss() {
    boss = {
        x: canvas.width / 2 - 75,
        y: 50,
        width: 150,
        height: 80,
        health: 20 + level * 5,
        maxHealth: 20 + level * 5,
        color: '#ff0000',
        alive: true,
        direction: 1,
        speed: 2
    };
    bossActive = true;
}

// ボスの更新
function updateBoss() {
    if (!boss || !boss.alive) return;
    
    boss.x += boss.speed * boss.direction;
    
    if (boss.x <= 0 || boss.x + boss.width >= canvas.width) {
        boss.direction *= -1;
    }
    
    // ボスが弾丸を発射
    if (Math.random() < 0.02) {
        for (let i = -1; i <= 1; i++) {
            enemyBullets.push({
                x: boss.x + boss.width / 2 - 2.5 + i * 20,
                y: boss.y + boss.height,
                speed: 4
            });
        }
        playEnemyShootSound();
    }
}

// スコア更新
function updateScore() {
    document.getElementById('score').textContent = score;
    
    // ハイスコア更新
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore.toString());
        document.getElementById('highScore').textContent = highScore;
    }
    
    // コンボタイマー更新
    const now = Date.now();
    if (now > comboTime) {
        combo = 0;
    }
    
    // すべての敵を倒したら次のレベル
    if (enemies.every(e => !e.alive) && !bossActive) {
        // レベル5の倍数でボス出現
        if (level % 5 === 0) {
            initBoss();
        } else {
            level++;
            document.getElementById('level').textContent = level;
            enemySpeed += 0.5;
            playLevelUpSound();
            initEnemies();
        }
    }
    
    // ボスを倒したら次のレベル
    if (boss && !boss.alive && bossActive) {
        level++;
        document.getElementById('level').textContent = level;
        enemySpeed += 0.5;
        playLevelUpSound();
        bossActive = false;
        initEnemies();
    }
}

// プレイヤーのパワーアップ更新
function updatePlayerPowerUps() {
    const now = Date.now();
    
    if (player.rapidFire && now > player.rapidFireTime) {
        player.rapidFire = false;
        player.shootCooldown = 200;
    }
    
    if (player.spreadShot && now > player.spreadShotTime) {
        player.spreadShot = false;
    }
    
    if (player.shield && now > player.shieldTime) {
        player.shield = false;
    }
}

// 残機更新
function updateLives() {
    document.getElementById('lives').textContent = lives;
}

// ゲームオーバー
function gameOver() {
    gameState = 'gameOver';
    document.getElementById('finalScore').textContent = score;
    if (score > highScore) {
        document.getElementById('newRecord').classList.remove('hidden');
    }
    document.getElementById('gameOver').classList.remove('hidden');
}

// ゲームリスタート
function restartGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    enemySpeed = 1;
    combo = 0;
    comboTime = 0;
    lastKillTime = 0;
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    explosions = [];
    powerUps = [];
    boss = null;
    bossActive = false;
    player.x = canvas.width / 2 - 25;
    player.rapidFire = false;
    player.spreadShot = false;
    player.shield = false;
    player.shootCooldown = 200;
    document.getElementById('newRecord').classList.add('hidden');
    initEnemies();
    updateScore();
    updateLives();
    document.getElementById('level').textContent = level;
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('startScreen').classList.add('hidden');
}

// ゲームループ
function gameLoop() {
    // キャンバスクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 星空エフェクト
    for (let i = 0; i < 50; i++) {
        const x = (i * 37) % canvas.width;
        const y = (i * 53 + Date.now() * 0.1) % canvas.height;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, 1, 1);
    }
    
    if (gameState === 'playing' && !isPaused) {
        updatePlayer();
        updatePlayerPowerUps();
        
        // 連射パワーアップ時は自動で発射
        if (player.rapidFire && keys[' ']) {
            shootPlayerBullet();
        }
        
        updateBullets();
        updateEnemies();
        updatePowerUps();
        if (bossActive) {
            updateBoss();
        }
        updateParticles();
        updateExplosions();
        
        drawPlayer();
        drawEnemies();
        if (bossActive) {
            drawBoss();
        }
        drawPowerUps();
        drawBullets();
        
        // コンボ表示
        if (combo > 1) {
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffff00';
            ctx.fillText(`${combo} COMBO!`, canvas.width / 2, 50);
            ctx.shadowBlur = 0;
        }
        
        // パワーアップ状態表示
        let powerUpY = canvas.height - 100;
        if (player.rapidFire) {
            ctx.fillStyle = '#00ff00';
            ctx.font = '16px Arial';
            ctx.fillText('⚡ 連射', 10, powerUpY);
            powerUpY -= 20;
        }
        if (player.spreadShot) {
            ctx.fillStyle = '#ffff00';
            ctx.font = '16px Arial';
            ctx.fillText('💥 拡散', 10, powerUpY);
            powerUpY -= 20;
        }
        if (player.shield) {
            ctx.fillStyle = '#00ffff';
            ctx.font = '16px Arial';
            ctx.fillText('🛡 シールド', 10, powerUpY);
        }
    } else if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 50px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('一時停止', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText('Pキーで再開', canvas.width / 2, canvas.height / 2 + 50);
    }
    
    requestAnimationFrame(gameLoop);
}

// イベントリスナー
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // 一時停止
    if (e.key === 'p' || e.key === 'P') {
        if (gameState === 'playing') {
            isPaused = !isPaused;
        }
        return;
    }
    
    if (isPaused) return;
    
    if (e.key === ' ' && gameState === 'playing') {
        e.preventDefault();
        shootPlayerBullet();
    }
    
    if (e.key === ' ' && gameState === 'start') {
        e.preventDefault();
        gameState = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.getElementById('restartBtn').addEventListener('click', restartGame);

// ゲーム初期化
initEnemies();
if (highScore > 0) {
    document.getElementById('highScore').textContent = highScore;
}
gameLoop();
