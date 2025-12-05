// Canvas設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ゲーム状態
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let lives = 3;
let level = 1;
let animationId = null;

// プレイヤー
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 60,
    width: 40,
    height: 30,
    speed: 5,
    color: '#00ff00'
};

// 弾丸
let playerBullets = [];
let enemyBullets = [];
const bulletSpeed = 7;
const enemyBulletSpeed = 3;

// インベーダー（敵）
let invaders = [];
const invaderRows = 5;
const invaderCols = 11;
const invaderWidth = 30;
const invaderHeight = 20;
const invaderPadding = 10;
let invaderSpeed = 1;
let invaderDirection = 1; // 1: 右, -1: 左
let invaderDropDistance = 20;

// キー入力
const keys = {
    left: false,
    right: false,
    space: false
};

// イベントリスナー
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === ' ') {
        e.preventDefault();
        if (gameState === 'playing' && !keys.space) {
            shootPlayerBullet();
            keys.space = true;
        }
    }
    if (e.key === 'Enter' && gameState !== 'playing') {
        startGame();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === ' ') keys.space = false;
});

document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', startGame);

// ゲーム初期化
function initGame() {
    score = 0;
    lives = 3;
    level = 1;
    invaderSpeed = 1;
    playerBullets = [];
    enemyBullets = [];
    player.x = canvas.width / 2 - 20;
    createInvaders();
    updateDisplay();
}

// インベーダー生成
function createInvaders() {
    invaders = [];
    const offsetX = 50;
    const offsetY = 50;
    
    for (let row = 0; row < invaderRows; row++) {
        for (let col = 0; col < invaderCols; col++) {
            invaders.push({
                x: offsetX + col * (invaderWidth + invaderPadding),
                y: offsetY + row * (invaderHeight + invaderPadding),
                width: invaderWidth,
                height: invaderHeight,
                alive: true,
                type: row // 異なるタイプのインベーダー
            });
        }
    }
}

// ゲーム開始
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    gameState = 'playing';
    initGame();
    gameLoop();
}

// プレイヤーの弾丸発射
function shootPlayerBullet() {
    playerBullets.push({
        x: player.x + player.width / 2 - 2,
        y: player.y,
        width: 4,
        height: 10,
        color: '#00ff00'
    });
}

// 敵の弾丸発射
function shootEnemyBullet() {
    // ランダムに生きているインベーダーを選択
    const aliveInvaders = invaders.filter(inv => inv.alive);
    if (aliveInvaders.length > 0 && Math.random() < 0.02) {
        const randomInvader = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
        enemyBullets.push({
            x: randomInvader.x + randomInvader.width / 2 - 2,
            y: randomInvader.y + randomInvader.height,
            width: 4,
            height: 10,
            color: '#ff0000'
        });
    }
}

// プレイヤー移動
function movePlayer() {
    if (keys.left && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys.right && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
}

// 弾丸移動
function moveBullets() {
    // プレイヤーの弾丸
    playerBullets = playerBullets.filter(bullet => {
        bullet.y -= bulletSpeed;
        return bullet.y > 0;
    });
    
    // 敵の弾丸
    enemyBullets = enemyBullets.filter(bullet => {
        bullet.y += enemyBulletSpeed;
        return bullet.y < canvas.height;
    });
}

// インベーダー移動
function moveInvaders() {
    let shouldDrop = false;
    
    // 端に到達したかチェック
    for (let invader of invaders) {
        if (!invader.alive) continue;
        
        if ((invader.x + invader.width >= canvas.width && invaderDirection === 1) ||
            (invader.x <= 0 && invaderDirection === -1)) {
            shouldDrop = true;
            break;
        }
    }
    
    // 端に到達したら方向転換して下に移動
    if (shouldDrop) {
        invaderDirection *= -1;
        for (let invader of invaders) {
            invader.y += invaderDropDistance;
        }
    }
    
    // 水平移動
    for (let invader of invaders) {
        invader.x += invaderSpeed * invaderDirection;
    }
}

// 衝突判定
function checkCollisions() {
    // プレイヤーの弾丸とインベーダー
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        
        for (let j = invaders.length - 1; j >= 0; j--) {
            const invader = invaders[j];
            
            if (invader.alive && 
                bullet.x < invader.x + invader.width &&
                bullet.x + bullet.width > invader.x &&
                bullet.y < invader.y + invader.height &&
                bullet.y + bullet.height > invader.y) {
                
                invader.alive = false;
                playerBullets.splice(i, 1);
                score += (5 - invader.type) * 10; // タイプによって得点が異なる
                updateDisplay();
                break;
            }
        }
    }
    
    // 敵の弾丸とプレイヤー
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        
        if (bullet.x < player.x + player.width &&
            bullet.x + bullet.width > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + bullet.height > player.y) {
            
            enemyBullets.splice(i, 1);
            loseLife();
            break;
        }
    }
    
    // インベーダーがプレイヤーの位置まで到達
    for (let invader of invaders) {
        if (invader.alive && invader.y + invader.height >= player.y) {
            gameOver();
            return;
        }
    }
    
    // 全てのインベーダーを倒したら次のレベル
    if (invaders.every(inv => !inv.alive)) {
        nextLevel();
    }
}

// ライフ減少
function loseLife() {
    lives--;
    updateDisplay();
    
    if (lives <= 0) {
        gameOver();
    }
}

// 次のレベル
function nextLevel() {
    level++;
    invaderSpeed += 0.5;
    createInvaders();
    playerBullets = [];
    enemyBullets = [];
    updateDisplay();
}

// ゲームオーバー
function gameOver() {
    gameState = 'gameOver';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// 表示更新
function updateDisplay() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    
    let heartsDisplay = '';
    for (let i = 0; i < lives; i++) {
        heartsDisplay += '❤️';
    }
    document.getElementById('lives').textContent = heartsDisplay;
}

// 描画
function draw() {
    // 背景をクリア
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 星空を描画
    drawStars();
    
    // プレイヤー描画
    drawPlayer();
    
    // インベーダー描画
    drawInvaders();
    
    // 弾丸描画
    drawBullets();
}

// 星空描画
function drawStars() {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
        const x = (i * 137) % canvas.width; // 疑似ランダム配置
        const y = (i * 241) % canvas.height;
        ctx.fillRect(x, y, 1, 1);
    }
}

// プレイヤー描画
function drawPlayer() {
    ctx.fillStyle = player.color;
    
    // 宇宙船の形
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    
    // 宇宙船の装飾
    ctx.fillStyle = '#00cc00';
    ctx.fillRect(player.x + player.width / 2 - 5, player.y + 10, 10, 5);
}

// インベーダー描画
function drawInvaders() {
    for (let invader of invaders) {
        if (!invader.alive) continue;
        
        // タイプによって色を変える
        const colors = ['#ff00ff', '#ff0066', '#ff6600', '#ffff00', '#00ffff'];
        ctx.fillStyle = colors[invader.type];
        
        // シンプルなインベーダーの形
        ctx.fillRect(invader.x + 5, invader.y, invader.width - 10, invader.height / 3);
        ctx.fillRect(invader.x, invader.y + invader.height / 3, invader.width, invader.height / 3);
        ctx.fillRect(invader.x + 3, invader.y + 2 * invader.height / 3, 8, invader.height / 3);
        ctx.fillRect(invader.x + invader.width - 11, invader.y + 2 * invader.height / 3, 8, invader.height / 3);
        
        // 目
        ctx.fillStyle = '#000000';
        ctx.fillRect(invader.x + 8, invader.y + 5, 4, 4);
        ctx.fillRect(invader.x + invader.width - 12, invader.y + 5, 4, 4);
    }
}

// 弾丸描画
function drawBullets() {
    // プレイヤーの弾丸
    for (let bullet of playerBullets) {
        ctx.fillStyle = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
    
    // 敵の弾丸
    for (let bullet of enemyBullets) {
        ctx.fillStyle = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
}

// ゲームループ
function gameLoop() {
    if (gameState !== 'playing') {
        return;
    }
    
    movePlayer();
    moveBullets();
    moveInvaders();
    shootEnemyBullet();
    checkCollisions();
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
}

// 初期描画
draw();
