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

// パーティクルエフェクト
let particles = [];
let explosions = [];

// バリア/シールド
let barriers = [];
const barrierCount = 4;
const barrierWidth = 80;
const barrierHeight = 60;

// パワーアップアイテム
let powerUps = [];
let playerPowerUp = null; // {type: 'rapid', timeLeft: 0}

// ボス敵
let boss = null;
let bossSpawnLevel = 3; // 3レベルごとにボス出現

// ハイスコア
let highScore = parseInt(localStorage.getItem('invaderHighScore') || '0');

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

// バリアの初期化
function initBarriers() {
    barriers = [];
    const spacing = canvas.width / (barrierCount + 1);
    
    for (let i = 0; i < barrierCount; i++) {
        const barrier = {
            x: spacing * (i + 1) - barrierWidth / 2,
            y: canvas.height - 150,
            width: barrierWidth,
            height: barrierHeight,
            blocks: []
        };
        
        // バリアをブロックに分割（ピクセル単位でダメージを管理）
        const blockSize = 4;
        for (let by = 0; by < barrierHeight; by += blockSize) {
            for (let bx = 0; bx < barrierWidth; bx += blockSize) {
                // バリアの形状（中央上部が欠けた形）
                const centerX = barrierWidth / 2;
                const centerY = barrierHeight * 0.2; // 上部20%の位置
                const distX = Math.abs(bx - centerX);
                const distY = by - centerY;
                
                // 上部のアーチ形状を作成（円形の欠け）
                const archRadius = barrierWidth * 0.15;
                if (distX * distX + distY * distY < archRadius * archRadius && distY < 0) {
                    continue; // 上部のアーチ部分をスキップ
                }
                
                // 中央下部の小さな欠け
                const bottomCenterY = barrierHeight * 0.7;
                const bottomDistY = by - bottomCenterY;
                const bottomArchRadius = barrierWidth * 0.1;
                if (distX * distX + bottomDistY * bottomDistY < bottomArchRadius * bottomArchRadius && bottomDistY > 0) {
                    continue; // 中央下部の小さなアーチ部分をスキップ
                }
                
                barrier.blocks.push({
                    x: barrier.x + bx,
                    y: barrier.y + by,
                    width: blockSize,
                    height: blockSize,
                    alive: true
                });
            }
        }
        
        barriers.push(barrier);
    }
}

// バリアの描画
function drawBarriers() {
    barriers.forEach(barrier => {
        barrier.blocks.forEach(block => {
            if (!block.alive) return;
            
            ctx.fillStyle = '#00ff00';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#00ff00';
            ctx.fillRect(block.x, block.y, block.width, block.height);
            ctx.shadowBlur = 0;
        });
    });
}

// バリアと弾丸の衝突判定
function checkBarrierCollision(bullet, isPlayerBullet) {
    for (let i = 0; i < barriers.length; i++) {
        const barrier = barriers[i];
        for (let j = 0; j < barrier.blocks.length; j++) {
            const block = barrier.blocks[j];
            if (!block.alive) continue;
            
            if (bullet.x < block.x + block.width &&
                bullet.x + 5 > block.x &&
                bullet.y < block.y + block.height &&
                bullet.y + 15 > block.y) {
                
                block.alive = false;
                createParticles(block.x + block.width / 2, block.y + block.height / 2, '#00ff00', 5);
                return true;
            }
        }
    }
    return false;
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

// 敵の弾丸の更新（横方向の速度を考慮）
function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.y += bullet.speed;
        if (bullet.vx) {
            bullet.x += bullet.vx;
        }
        
        if (bullet.y > canvas.height || bullet.x < 0 || bullet.x > canvas.width) {
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // バリアとの衝突判定
        if (checkBarrierCollision(bullet, false)) {
            enemyBullets.splice(i, 1);
            continue;
        }
        
        // プレイヤーとの衝突判定
        if (bullet.x < player.x + player.width &&
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
    if (playerPowerUp && playerPowerUp.type === 'rapid') {
        // 3連射
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                playerBullets.push({
                    x: player.x + player.width / 2 - 2.5 + (i - 1) * 10,
                    y: player.y,
                    speed: 7
                });
                playShootSound();
            }, i * 50);
        }
    } else {
        playerBullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            speed: 7
        });
        playShootSound();
    }
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
        
        if (bullet.y < 0) {
            playerBullets.splice(i, 1);
            continue;
        }
        
        // バリアとの衝突判定
        if (checkBarrierCollision(bullet, true)) {
            playerBullets.splice(i, 1);
            continue;
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
                playHitSound();
                
                if (boss.health <= 0) {
                    boss.alive = false;
                    score += 500;
                    createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 100);
                    playExplosionSound();
                    updateScore();
                }
                continue;
            }
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
                score += 10;
                
                // パワーアップのドロップ（5%の確率）
                if (Math.random() < 0.05) {
                    powerUps.push({
                        x: enemy.x + enemy.width / 2,
                        y: enemy.y + enemy.height / 2,
                        width: 20,
                        height: 20,
                        speed: 2,
                        type: Math.random() < 0.5 ? 'rapid' : 'speed',
                        color: Math.random() < 0.5 ? '#ff00ff' : '#ffff00'
                    });
                }
                
                createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                playExplosionSound();
                updateScore();
                break;
            }
        }
    }
    
    // 敵の弾丸の更新は updateEnemyBullets() で行う
}

// 敵の移動
function updateEnemies() {
    let moveDown = false;
    
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        // より多様な動きパターン（ジグザグ動き）
        const row = Math.floor((enemy.y - 50) / 40);
        const zigzag = Math.sin(Date.now() * 0.001 + row) * 0.5;
        enemy.x += enemySpeed * enemyDirection + zigzag;
        
        if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
            moveDown = true;
        }
        
        // 敵がプレイヤーに到達
        if (enemy.y + enemy.height >= player.y) {
            gameOver();
        }
        
        // 敵が弾丸を発射（下の列の敵ほど発射確率が高い）
        const shootProbability = 0.01 + (row / enemyRows) * 0.02;
        if (Math.random() < shootProbability) {
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

// ボス敵の初期化
function initBoss() {
    // レベルが3の倍数の時、ボスが存在しない場合のみ初期化
    // レベル3, 6, 9...でボスが出現
    if (level > 0 && level % bossSpawnLevel === 0 && (!boss || !boss.alive)) {
        boss = {
            x: canvas.width / 2 - 60,
            y: 50,
            width: 120,
            height: 60,
            speed: 2 + (level / bossSpawnLevel) * 0.5, // レベルが上がるごとに速くなる
            direction: 1,
            health: 10 + Math.floor(level / bossSpawnLevel) * 5,
            maxHealth: 10 + Math.floor(level / bossSpawnLevel) * 5,
            color: '#ff0000',
            alive: true,
            shootCooldown: 0
        };
    }
}

// ボス敵の更新
function updateBoss() {
    if (!boss || !boss.alive) return;
    
    // ボスの移動（左右に動く）
    boss.x += boss.speed * boss.direction;
    if (boss.x <= 0 || boss.x + boss.width >= canvas.width) {
        boss.direction *= -1;
    }
    
    // ボスの弾丸発射
    boss.shootCooldown--;
    if (boss.shootCooldown <= 0) {
        // 3方向に発射
        for (let i = -1; i <= 1; i++) {
            enemyBullets.push({
                x: boss.x + boss.width / 2 - 2.5 + i * 20,
                y: boss.y + boss.height,
                speed: 4,
                vx: i * 1 // 横方向の速度
            });
        }
        boss.shootCooldown = 60;
        playEnemyShootSound();
    }
}

// ボス敵の描画
function drawBoss() {
    if (!boss || !boss.alive) return;
    
    ctx.fillStyle = boss.color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = boss.color;
    
    // ボスの描画（大きなUFO）
    ctx.beginPath();
    ctx.arc(boss.x + boss.width / 2, boss.y + boss.height / 2, boss.width / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // ヘルスバー
    const barWidth = boss.width;
    const barHeight = 5;
    const healthPercent = boss.health / boss.maxHealth;
    
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(boss.x, boss.y - 10, barWidth, barHeight);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(boss.x, boss.y - 10, barWidth * healthPercent, barHeight);
    
    ctx.shadowBlur = 0;
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
            
            playerPowerUp = {
                type: powerUp.type,
                timeLeft: 600 // 10秒（60fps * 10）
            };
            
            if (powerUp.type === 'speed') {
                player.speed = 8; // スピードアップ
            }
            
            powerUps.splice(i, 1);
            playLevelUpSound();
        }
    }
    
    // パワーアップの効果時間を更新
    if (playerPowerUp) {
        playerPowerUp.timeLeft--;
        if (playerPowerUp.timeLeft <= 0) {
            if (playerPowerUp.type === 'speed') {
                player.speed = 5; // 元の速度に戻す
            }
            playerPowerUp = null;
        }
    }
}

// パワーアップアイテムの描画
function drawPowerUps() {
    powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = powerUp.color;
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        
        // アイコン（星型）
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(powerUp.x + powerUp.width / 2, powerUp.y);
        ctx.lineTo(powerUp.x + powerUp.width * 0.6, powerUp.y + powerUp.height * 0.4);
        ctx.lineTo(powerUp.x + powerUp.width, powerUp.y + powerUp.height * 0.4);
        ctx.lineTo(powerUp.x + powerUp.width * 0.7, powerUp.y + powerUp.height * 0.6);
        ctx.lineTo(powerUp.x + powerUp.width * 0.8, powerUp.y + powerUp.height);
        ctx.lineTo(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height * 0.8);
        ctx.lineTo(powerUp.x + powerUp.width * 0.2, powerUp.y + powerUp.height);
        ctx.lineTo(powerUp.x + powerUp.width * 0.3, powerUp.y + powerUp.height * 0.6);
        ctx.lineTo(powerUp.x, powerUp.y + powerUp.height * 0.4);
        ctx.lineTo(powerUp.x + powerUp.width * 0.4, powerUp.y + powerUp.height * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

// スコア更新
function updateScore() {
    document.getElementById('score').textContent = score;
    
    // ハイスコアの更新
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('invaderHighScore', highScore.toString());
        document.getElementById('highScore').textContent = highScore;
    }
    
    // すべての敵を倒したら次のレベル
    const allEnemiesDead = enemies.every(e => !e.alive);
    const bossDead = !boss || !boss.alive;
    
    if (allEnemiesDead && bossDead) {
        level++;
        document.getElementById('level').textContent = level;
        enemySpeed += 0.5;
        boss = null; // ボスをリセット
        playLevelUpSound();
        initEnemies();
        initBarriers(); // バリアを再生成
        initBoss(); // ボスをチェック
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
    
    // ハイスコアの更新
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('invaderHighScore', highScore.toString());
    }
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('finalHighScore').textContent = highScore;
    
    document.getElementById('gameOver').classList.remove('hidden');
}

// ゲームリスタート
function restartGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    enemySpeed = 1;
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    explosions = [];
    powerUps = [];
    playerPowerUp = null;
    boss = null;
    player.x = canvas.width / 2 - 25;
    player.speed = 5;
    initEnemies();
    initBarriers();
    initBoss();
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
        updateEnemyBullets();
        updateEnemies();
        updateBoss();
        updatePowerUps();
        updateParticles();
        updateExplosions();
        
        drawBarriers();
        drawPlayer();
        drawEnemies();
        drawBoss();
        drawPowerUps();
        drawBullets();
        
        // パワーアップの残り時間表示
        if (playerPowerUp) {
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.fillText(`パワーアップ: ${playerPowerUp.type} (${Math.ceil(playerPowerUp.timeLeft / 60)}秒)`, 10, 30);
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
initBarriers();
initBoss();
document.getElementById('highScore').textContent = highScore;
gameLoop();
