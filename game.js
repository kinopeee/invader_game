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
let highScore = localStorage.getItem('highScore') || 0;
let combo = 0;
let comboTimer = 0;
let difficulty = 'normal'; // 'easy', 'normal', 'hard'

// プレイヤー
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 50,
    width: 50,
    height: 30,
    speed: 5,
    color: '#00ffff'
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

// パーティクルエフェクト
let particles = [];
let explosions = [];

// パワーアップシステム
let powerUps = [];
let activePowerUp = null;
let powerUpTimer = 0;
let shield = false;
let rapidFire = false;
let tripleFire = false;

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

// 敵の初期化
function initEnemies() {
    enemies = [];
    bossActive = false;
    const startX = 100;
    const startY = 50;
    
    for (let row = 0; row < enemyRows; row++) {
        for (let col = 0; col < enemyCols; col++) {
            let enemyType = 'normal';
            let points = 10;
            
            // 特殊な敵をランダムに配置
            const rand = Math.random();
            if (rand < 0.1) {
                enemyType = 'zigzag'; // ジグザグに動く敵
                points = 20;
            } else if (rand < 0.2) {
                enemyType = 'fast'; // 速い敵
                points = 15;
            } else if (rand < 0.25) {
                enemyType = 'tank'; // タンク（体力が高い）
                points = 30;
            }
            
            enemies.push({
                x: startX + col * enemySpacing,
                y: startY + row * 40,
                width: 40,
                height: 30,
                color: `hsl(${row * 60}, 100%, 50%)`,
                alive: true,
                type: enemyType,
                points: points,
                health: enemyType === 'tank' ? 3 : 1,
                zigzagOffset: 0
            });
        }
    }
}

// ボスの初期化
function initBoss() {
    bossActive = true;
    boss = {
        x: canvas.width / 2 - 75,
        y: 50,
        width: 150,
        height: 100,
        health: 50,
        maxHealth: 50,
        speed: 2,
        direction: 1,
        color: '#ff0000',
        shootTimer: 0,
        shootDelay: 60
    };
}

// ボスの描画
function drawBoss() {
    if (!boss) return;
    
    // ボスの本体
    ctx.fillStyle = boss.color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = boss.color;
    ctx.beginPath();
    ctx.arc(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // ボスの目
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(boss.x + 40, boss.y + 40, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(boss.x + 110, boss.y + 40, 15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(boss.x + 40, boss.y + 40, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(boss.x + 110, boss.y + 40, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // 体力バー
    ctx.fillStyle = '#333';
    ctx.fillRect(boss.x, boss.y - 20, boss.width, 10);
    ctx.fillStyle = '#00ff00';
    const healthPercent = boss.health / boss.maxHealth;
    ctx.fillRect(boss.x, boss.y - 20, boss.width * healthPercent, 10);
    
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
    if (boss.shootTimer >= boss.shootDelay) {
        boss.shootTimer = 0;
        // 5方向に弾丸を発射
        for (let i = -2; i <= 2; i++) {
            enemyBullets.push({
                x: boss.x + boss.width / 2 - 2.5 + i * 20,
                y: boss.y + boss.height,
                speed: 4,
                vx: i * 0.5
            });
        }
        playEnemyShootSound();
    }
    
    // ボスとの衝突判定
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        
        if (bullet.x < boss.x + boss.width &&
            bullet.x + 5 > boss.x &&
            bullet.y < boss.y + boss.height &&
            bullet.y + 15 > boss.y) {
            
            playerBullets.splice(i, 1);
            boss.health--;
            createParticles(bullet.x, bullet.y, boss.color, 10);
            playHitSound();
            
            if (boss.health <= 0) {
                score += 500;
                createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 100);
                playExplosionSound();
                updateScore();
                boss = null;
                bossActive = false;
                initEnemies();
            }
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

// パワーアップの作成
function createPowerUp() {
    if (Math.random() < 0.1 && powerUps.length === 0) { // 10%の確率でパワーアップ出現
        const types = ['rapidFire', 'tripleFire', 'shield'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = {
            rapidFire: '#ff00ff',
            tripleFire: '#00ffff',
            shield: '#ffff00'
        };
        const icons = {
            rapidFire: 'R',
            tripleFire: '3',
            shield: 'S'
        };
        powerUps.push({
            x: Math.random() * (canvas.width - 40),
            y: 0,
            width: 40,
            height: 40,
            speed: 2,
            type: type,
            color: colors[type],
            icon: icons[type]
        });
    }
}

// パワーアップの描画
function drawPowerUps() {
    powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = powerUp.color;
        ctx.beginPath();
        ctx.arc(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(powerUp.icon, powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
    });
}

// パワーアップの更新
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
            
            activatePowerUp(powerUp.type);
            powerUps.splice(i, 1);
            playSound(600, 0.2, 'sine', 0.3);
        }
    }
    
    // パワーアップタイマー
    if (powerUpTimer > 0) {
        powerUpTimer--;
        if (powerUpTimer === 0) {
            rapidFire = false;
            tripleFire = false;
        }
    }
}

// パワーアップの発動
function activatePowerUp(type) {
    if (type === 'rapidFire') {
        rapidFire = true;
        tripleFire = false;
        powerUpTimer = 600; // 10秒
        activePowerUp = 'rapidFire';
    } else if (type === 'tripleFire') {
        tripleFire = true;
        rapidFire = false;
        powerUpTimer = 600;
        activePowerUp = 'tripleFire';
    } else if (type === 'shield') {
        shield = true;
        activePowerUp = 'shield';
    }
}

// プレイヤーの描画
function drawPlayer() {
    // シールドの描画
    if (shield) {
        ctx.strokeStyle = '#ffff00';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 35, 0, Math.PI * 2);
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
        
        // 敵タイプによって色を変える
        let color = enemy.color;
        if (enemy.type === 'zigzag') {
            color = '#ff00ff';
        } else if (enemy.type === 'fast') {
            color = '#00ffff';
        } else if (enemy.type === 'tank') {
            color = '#ff8800';
        }
        
        ctx.fillStyle = color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        
        // 敵の描画（UFO風）
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 装飾
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x + 5, enemy.y + 5, 10, 5);
        ctx.fillRect(enemy.x + enemy.width - 15, enemy.y + 5, 10, 5);
        
        // タンクの体力表示
        if (enemy.type === 'tank' && enemy.health > 1) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 0;
            ctx.fillText(enemy.health, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2 + 4);
        }
        
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
let lastShootTime = 0;
function shootPlayerBullet() {
    const now = Date.now();
    const shootDelay = rapidFire ? 100 : 300; // 速射モードでは0.1秒、通常は0.3秒
    
    if (now - lastShootTime < shootDelay) {
        return;
    }
    lastShootTime = now;
    
    if (tripleFire) {
        // 3方向弾
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            vx: 0
        });
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            vx: -2
        });
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            vx: 2
        });
    } else {
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7,
            vx: 0
        });
    }
    playShootSound();
}

// この関数は不要になったので削除（updateEnemies内で処理）

// 弾丸の更新
function updateBullets() {
    // プレイヤーの弾丸
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        bullet.y -= bullet.speed;
        if (bullet.vx) {
            bullet.x += bullet.vx;
        }
        
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
                
                if (enemy.health <= 0) {
                    // 敵を倒した
                    enemy.alive = false;
                    
                    // コンボシステム
                    combo++;
                    comboTimer = 120; // 2秒以内に次の敵を倒すとコンボ継続
                    const comboMultiplier = Math.min(Math.floor(combo / 5) + 1, 5); // 最大5倍
                    score += enemy.points * comboMultiplier;
                    
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                    createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    playExplosionSound();
                } else {
                    // ダメージのみ
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color, 5);
                    playHitSound();
                }
                
                playerBullets.splice(i, 1);
                updateScore();
                break;
            }
        }
    }
    
    // 敵の弾丸
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.y += bullet.speed;
        if (bullet.vx) {
            bullet.x += bullet.vx;
        }
        
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
            
            if (shield) {
                shield = false;
                activePowerUp = null;
                createExplosion(player.x + player.width / 2, player.y + player.height / 2, 40);
                playSound(300, 0.2, 'square', 0.3);
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
        
        // 特殊な敵の動き
        if (enemy.type === 'zigzag') {
            enemy.zigzagOffset += 0.1;
            enemy.x += enemySpeed * enemyDirection + Math.sin(enemy.zigzagOffset) * 2;
        } else if (enemy.type === 'fast') {
            enemy.x += enemySpeed * enemyDirection * 1.5;
        } else {
            enemy.x += enemySpeed * enemyDirection;
        }
        
        if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
            moveDown = true;
        }
        
        // 敵がプレイヤーに到達
        if (enemy.y + enemy.height >= player.y) {
            gameOver();
        }
        
        // 敵が弾丸を発射（タンクは発射頻度が高い）
        const shootChance = enemy.type === 'tank' ? 0.02 : 0.01;
        if (Math.random() < shootChance) {
            enemyBullets.push({
                x: enemy.x + enemy.width / 2 - 2.5,
                y: enemy.y + enemy.height,
                speed: 3
            });
            playEnemyShootSound();
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

// スコア更新
function updateScore() {
    document.getElementById('score').textContent = score;
    
    // ハイスコア更新
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
    
    // すべての敵を倒したら次のレベル
    if (enemies.every(e => !e.alive)) {
        level++;
        document.getElementById('level').textContent = level;
        enemySpeed += 0.5;
        playLevelUpSound();
        
        // 5レベルごとにボス戦
        if (level % 5 === 0) {
            initBoss();
        } else {
            initEnemies();
        }
    }
}

// コンボタイマーの更新
function updateCombo() {
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) {
            combo = 0;
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
    document.getElementById('finalScore').textContent = score;
    
    // 新記録チェック
    if (score > parseInt(localStorage.getItem('highScore') || 0)) {
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
    combo = 0;
    comboTimer = 0;
    activePowerUp = null;
    powerUpTimer = 0;
    shield = false;
    rapidFire = false;
    tripleFire = false;
    
    // 難易度に応じて設定
    if (difficulty === 'easy') {
        lives = 5;
        enemySpeed = 0.7;
    } else if (difficulty === 'normal') {
        lives = 3;
        enemySpeed = 1;
    } else if (difficulty === 'hard') {
        lives = 2;
        enemySpeed = 1.5;
    }
    
    level = 1;
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    explosions = [];
    powerUps = [];
    player.x = canvas.width / 2 - 25;
    boss = null;
    bossActive = false;
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
    
    if (gameState === 'playing') {
        updatePlayer();
        updateBullets();
        updateCombo();
        updatePowerUps();
        createPowerUp();
        
        if (bossActive) {
            updateBoss();
        } else {
            updateEnemies();
        }
        
        updateParticles();
        updateExplosions();
        
        drawPlayer();
        if (bossActive) {
            drawBoss();
        } else {
            drawEnemies();
        }
        drawBullets();
        drawPowerUps();
        
        // コンボ表示
        if (combo > 0) {
            const comboMultiplier = Math.min(Math.floor(combo / 5) + 1, 5);
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffff00';
            ctx.fillText(`COMBO x${comboMultiplier}`, canvas.width / 2, 50);
            ctx.shadowBlur = 0;
        }
        
        // パワーアップ表示
        if (activePowerUp) {
            ctx.fillStyle = '#00ffff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Power: ${activePowerUp.toUpperCase()}`, 10, 30);
            if (powerUpTimer > 0) {
                ctx.fillText(`Time: ${Math.ceil(powerUpTimer / 60)}s`, 10, 55);
            }
        }
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
        restartGame();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.getElementById('restartBtn').addEventListener('click', restartGame);

// 難易度選択
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        difficulty = btn.dataset.difficulty;
    });
});

// モバイルコントロール
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const shootBtn = document.getElementById('shootBtn');

leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = true;
});

leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['ArrowLeft'] = false;
});

leftBtn.addEventListener('mousedown', () => {
    keys['ArrowLeft'] = true;
});

leftBtn.addEventListener('mouseup', () => {
    keys['ArrowLeft'] = false;
});

rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = true;
});

rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys['ArrowRight'] = false;
});

rightBtn.addEventListener('mousedown', () => {
    keys['ArrowRight'] = true;
});

rightBtn.addEventListener('mouseup', () => {
    keys['ArrowRight'] = false;
});

shootBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'playing') {
        shootPlayerBullet();
    }
});

shootBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (gameState === 'playing') {
        shootPlayerBullet();
    }
});

// タッチでゲームスタート
canvas.addEventListener('touchstart', (e) => {
    if (gameState === 'start') {
        e.preventDefault();
        gameState = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
        restartGame();
    }
});

// ゲーム初期化
initEnemies();
document.getElementById('highScore').textContent = highScore;
gameLoop();
