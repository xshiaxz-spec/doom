const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const TILE_SIZE = 64;
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,1,0,0,0,0,1,0,0,0,1],
  [1,0,1,0,0,1,0,0,0,1,0,1],
  [1,0,0,0,0,1,0,0,0,1,0,1],
  [1,0,0,1,0,0,0,1,0,0,0,1],
  [1,0,0,1,0,0,0,1,0,0,0,1],
  [1,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
];

function isWall(x, y) {
  const mapX = Math.floor(x / TILE_SIZE);
  const mapY = Math.floor(y / TILE_SIZE);

  if (
    mapY < 0 ||
    mapY >= MAP.length ||
    mapX < 0 ||
    mapX >= MAP[0].length
  ) {
    return true;
  }

  return MAP[mapY][mapX] !== 0;
}

class Player {
  constructor() {
    this.x = TILE_SIZE * 2;
    this.y = TILE_SIZE * 2;
    this.angle = 0;
    this.radius = 14;
    this.speed = 220;
    this.turnSpeed = 2.6;
    this.health = 100;
    this.ammo = 24;
  }

  move(dx, dy) {
    const nextX = this.x + dx;
    const nextY = this.y + dy;

    if (!isWall(nextX, this.y)) this.x = nextX;
    if (!isWall(this.x, nextY)) this.y = nextY;
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.speed = 70;
    this.alive = true;
    this.health = 100;
    this.hitFlash = 0;
    this.attackCooldown = 0;
  }

  update(dt, player) {
    if (!this.alive) return;

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 40) {
      const dirX = dx / dist;
      const dirY = dy / dist;

      const nextX = this.x + dirX * this.speed * dt;
      const nextY = this.y + dirY * this.speed * dt;

      if (!isWall(nextX, this.y)) this.x = nextX;
      if (!isWall(this.x, nextY)) this.y = nextY;
    }

    if (dist < 42 && this.attackCooldown <= 0) {
      player.health -= 12;
      this.attackCooldown = 0.9;
      if (player.health < 0) player.health = 0;
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    this.hitFlash = 0.15;
    if (this.health <= 0) {
      this.alive = false;
    }
  }
}

class Raycaster {
  constructor(player) {
    this.player = player;
    this.fov = Math.PI / 3;
    this.maxDepth = 1200;
    this.numRays = 0;
    this.projPlane = 0;
    this.depthBuffer = [];
  }

  updateDimensions() {
    this.numRays = Math.floor(canvas.width);
    this.projPlane = (canvas.width / 2) / Math.tan(this.fov / 2);
    this.depthBuffer = new Array(this.numRays).fill(this.maxDepth);
  }

  castSingleRay(angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    let depth = 0;
    const step = 2;

    while (depth < this.maxDepth) {
      const targetX = this.player.x + cos * depth;
      const targetY = this.player.y + sin * depth;

      if (isWall(targetX, targetY)) {
        return {
          depth,
          hitX: targetX,
          hitY: targetY,
        };
      }

      depth += step;
    }

    return {
      depth: this.maxDepth,
      hitX: this.player.x + cos * this.maxDepth,
      hitY: this.player.y + sin * this.maxDepth,
    };
  }

  render() {
    this.updateDimensions();

    const halfH = canvas.height / 2;

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, halfH);

    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, halfH, canvas.width, halfH);

    for (let ray = 0; ray < this.numRays; ray++) {
      const rayAngle =
        this.player.angle - this.fov / 2 + (ray / this.numRays) * this.fov;

      const hit = this.castSingleRay(rayAngle);
      const correctedDepth = hit.depth * Math.cos(rayAngle - this.player.angle);
      this.depthBuffer[ray] = correctedDepth;

      const wallHeight =
        (TILE_SIZE / Math.max(correctedDepth, 0.0001)) * this.projPlane;

      const wallTop = (canvas.height / 2) - wallHeight / 2;

      const shade = Math.max(30, 255 - correctedDepth * 0.22);
      ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
      ctx.fillRect(ray, wallTop, 1, wallHeight);
    }
  }
}

class Game {
  constructor() {
    this.player = new Player();
    this.raycaster = new Raycaster(this.player);
    this.keys = {};
    this.lastTime = 0;
    this.gameOver = false;
    this.win = false;

    this.weaponKick = 0;
    this.muzzleFlash = 0;
    this.damageFlash = 0;

    this.enemies = [
      new Enemy(TILE_SIZE * 6, TILE_SIZE * 3),
      new Enemy(TILE_SIZE * 8, TILE_SIZE * 8),
      new Enemy(TILE_SIZE * 9, TILE_SIZE * 2),
      new Enemy(TILE_SIZE * 3, TILE_SIZE * 9),
    ];

    this.setupEvents();
  }

  setupEvents() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;

      if (e.key === " ") {
        e.preventDefault();
        this.shoot();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    canvas.addEventListener("click", () => {
      canvas.requestPointerLock?.();
      this.shoot();
    });

    window.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === canvas && !this.gameOver && !this.win) {
        this.player.angle += e.movementX * 0.0025;
      }
    });
  }

  normalizeAngle(angle) {
    while (angle < -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
  }

  hasLineOfSight(enemy) {
    const dx = enemy.x - this.player.x;
    const dy = enemy.y - this.player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    const hit = this.raycaster.castSingleRay(angle);
    return hit.depth >= distance - 10;
  }

  shoot() {
    if (this.gameOver || this.win) return;
    if (this.player.ammo <= 0) return;

    this.player.ammo -= 1;
    this.weaponKick = 10;
    this.muzzleFlash = 0.06;

    let bestEnemy = null;
    let bestDistance = Infinity;

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distance = Math.hypot(dx, dy);
      const angleToEnemy = this.normalizeAngle(
        Math.atan2(dy, dx) - this.player.angle
      );

      const withinCrosshair = Math.abs(angleToEnemy) < 0.08;
      const visible = this.hasLineOfSight(enemy);

      if (withinCrosshair && visible && distance < bestDistance) {
        bestDistance = distance;
        bestEnemy = enemy;
      }
    });

    if (bestEnemy) {
      bestEnemy.takeDamage(50);
    }
  }

  update(dt) {
    if (this.gameOver || this.win) return;

    let moveStep = this.player.speed * dt;
    let moveX = 0;
    let moveY = 0;

    if (this.keys["arrowleft"] || this.keys["q"]) {
      this.player.angle -= this.player.turnSpeed * dt;
    }
    if (this.keys["arrowright"] || this.keys["e"]) {
      this.player.angle += this.player.turnSpeed * dt;
    }

    if (this.keys["w"] || this.keys["arrowup"]) {
      moveX += Math.cos(this.player.angle) * moveStep;
      moveY += Math.sin(this.player.angle) * moveStep;
    }
    if (this.keys["s"] || this.keys["arrowdown"]) {
      moveX -= Math.cos(this.player.angle) * moveStep;
      moveY -= Math.sin(this.player.angle) * moveStep;
    }

    const strafeAngle = this.player.angle + Math.PI / 2;

    if (this.keys["a"]) {
      moveX -= Math.cos(strafeAngle) * moveStep;
      moveY -= Math.sin(strafeAngle) * moveStep;
    }
    if (this.keys["d"]) {
      moveX += Math.cos(strafeAngle) * moveStep;
      moveY += Math.sin(strafeAngle) * moveStep;
    }

    this.player.move(moveX, moveY);

    this.enemies.forEach((enemy) => enemy.update(dt, this.player));

    const aliveEnemies = this.enemies.filter((enemy) => enemy.alive);
    if (aliveEnemies.length === 0) {
      this.win = true;
    }

    if (this.player.health <= 0) {
      this.gameOver = true;
    }

    if (this.weaponKick > 0) this.weaponKick -= 36 * dt;
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
  }

  drawEnemies() {
    const visibleEnemies = [];

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distance = Math.hypot(dx, dy);
      const angleToEnemy = this.normalizeAngle(
        Math.atan2(dy, dx) - this.player.angle
      );

      if (Math.abs(angleToEnemy) > this.raycaster.fov / 2 + 0.25) return;
      if (!this.hasLineOfSight(enemy)) return;

      visibleEnemies.push({ enemy, distance, angleToEnemy });
    });

    visibleEnemies.sort((a, b) => b.distance - a.distance);

    visibleEnemies.forEach(({ enemy, distance, angleToEnemy }) => {
      const correctedDistance = distance * Math.cos(angleToEnemy);
      const size =
        (TILE_SIZE / Math.max(correctedDistance, 0.0001)) *
        this.raycaster.projPlane *
        0.9;

      const screenX =
        canvas.width / 2 +
        Math.tan(angleToEnemy) * this.raycaster.projPlane;

      const left = Math.floor(screenX - size / 2);
      const top = Math.floor(canvas.height / 2 - size / 2);

      for (let x = 0; x < size; x++) {
        const screenCol = left + x;
        if (screenCol < 0 || screenCol >= canvas.width) continue;
        if (correctedDistance > this.raycaster.depthBuffer[screenCol]) continue;

        const bodyShade = enemy.hitFlash > 0 ? 255 : 190;
        const eyeShade = enemy.hitFlash > 0 ? 255 : 60;

        ctx.fillStyle = `rgb(${bodyShade}, ${enemy.hitFlash > 0 ? 80 : 70}, ${enemy.hitFlash > 0 ? 80 : 70})`;
        ctx.fillRect(screenCol, top + size * 0.2, 1, size * 0.8);

        if (x > size * 0.22 && x < size * 0.38) {
          ctx.fillStyle = `rgb(${eyeShade}, 0, 0)`;
          ctx.fillRect(screenCol, top + size * 0.35, 1, size * 0.08);
        }
        if (x > size * 0.62 && x < size * 0.78) {
          ctx.fillStyle = `rgb(${eyeShade}, 0, 0)`;
          ctx.fillRect(screenCol, top + size * 0.35, 1, size * 0.08);
        }
      }
    });
  }

  drawWeapon() {
    const w = 210;
    const h = 130;
    const x = canvas.width / 2 - w / 2;
    const y = canvas.height - h + this.weaponKick;

    ctx.save();

    ctx.fillStyle = "#202020";
    ctx.fillRect(x + 55, y + 18, 100, 70);

    ctx.fillStyle = "#111";
    ctx.fillRect(x + 78, y - 10, 54, 40);

    ctx.fillStyle = "#2f2f2f";
    ctx.fillRect(x + 90, y - 42, 30, 34);

    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(x + 78, y + 62, 24, 50);

    if (this.muzzleFlash > 0) {
      ctx.fillStyle = "rgba(255,220,120,0.95)";
      ctx.beginPath();
      ctx.moveTo(x + 105, y - 48);
      ctx.lineTo(x + 84, y - 82);
      ctx.lineTo(x + 105, y - 72);
      ctx.lineTo(x + 126, y - 82);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawCrosshair() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHud() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(18, 18, 170, 78);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px Arial";
    ctx.fillText(`HP: ${this.player.health}`, 30, 48);
    ctx.fillText(`AMMO: ${this.player.ammo}`, 30, 78);

    const alive = this.enemies.filter((e) => e.alive).length;
    ctx.fillText(`ENEMIES: ${alive}`, 30, 108);
    ctx.restore();
  }

  drawOverlay() {
    if (this.player.health < 35 && !this.gameOver) {
      ctx.fillStyle = "rgba(255,0,0,0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (this.gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ff3b3b";
      ctx.font = "bold 56px Arial";
      ctx.textAlign = "center";
      ctx.fillText("VOCÊ MORREU", canvas.width / 2, canvas.height / 2);

      ctx.font = "24px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("Recarregue a página para tentar de novo", canvas.width / 2, canvas.height / 2 + 46);
    }

    if (this.win) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#7dff7d";
      ctx.font = "bold 56px Arial";
      ctx.textAlign = "center";
      ctx.fillText("VOCÊ VENCEU", canvas.width / 2, canvas.height / 2);

      ctx.font = "24px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("Todos os inimigos foram derrotados", canvas.width / 2, canvas.height / 2 + 46);
    }

    ctx.textAlign = "start";
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.raycaster.render();
    this.drawEnemies();
    this.drawWeapon();
    this.drawCrosshair();
    this.drawHud();
    this.drawOverlay();
  }

  loop = (time) => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.033);
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  };

  start() {
    requestAnimationFrame((time) => {
      this.lastTime = time;
      this.loop(time);
    });
  }
}

const game = new Game();
game.start();
