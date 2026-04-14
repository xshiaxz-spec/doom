import { Input } from "./input.js";
import { Player } from "./entities/player.js";
import { Raycaster } from "./raycaster.js";
import { MAP, TILE_SIZE } from "./world/map.js";
import { Enemy } from "./entities/enemy.js";
import { LEVEL2 } from "./world/level2.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");

    this.input = new Input();
    this.player = new Player();
    this.raycaster = new Raycaster(this.ctx, this.canvas, this.player);

    this.lastTime = 0;
    this.deltaTime = 0;

    this.currentLevel = 1;
    this.started = true;
    this.paused = false;
    this.win = false;
    this.gameOver = false;

    this.deathAlpha = 0;
    this.deathPulse = 0;

    this.mouseSensitivity = 0.0025;

    this.recoil = 0;
    this.flash = 0;
    this.hitFlash = 0;
    this.damageFlash = 0;
    this.weaponBob = 0;

    this.gunKick = 0;
    this.gunSide = 0;

    this.screenShake = 0;
    this.cameraShakeX = 0;
    this.cameraShakeY = 0;

    this.weaponFrames = [
      { x: 900, y: 0, w: 200, h: 200 },
      { x: 1100, y: 0, w: 200, h: 200 }
    ];
    this.currentWeaponFrame = 0;
    this.weaponAnimTimer = 0;

    this.weaponSheet = new Image();
    this.weaponSheet.src = "./assets/sprites/doom_weapons.png";

    this.enemySprite = new Image();
    this.enemySprite.src = "./assets/sprites/enemy.png";

    this.enemies = [
      new Enemy(300, 300),
      new Enemy(500, 200),
      new Enemy(420, 500)
    ];

    this.handleMouseMove = this.handleMouseMove.bind(this);

    this.canvas.addEventListener("click", () => {
      if (this.gameOver || this.win) {
        this.restartGame();
        return;
      }

      if (!this.paused && document.pointerLockElement !== this.canvas) {
        setTimeout(() => {
          this.canvas.requestPointerLock();
        }, 100);
      }
    });

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.canvas) {
        document.addEventListener("mousemove", this.handleMouseMove);
      } else {
        document.removeEventListener("mousemove", this.handleMouseMove);
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.paused = !this.paused;

        if (this.paused) {
          document.exitPointerLock?.();
        } else if (!this.gameOver && !this.win) {
          setTimeout(() => {
            this.canvas.requestPointerLock();
          }, 100);
        }
      }
    });

    this.resize();
    window.addEventListener("resize", () => {
      this.resize();
      this.raycaster.handleResize();
    });
  }

  handleMouseMove(e) {
    if (this.gameOver || this.win) return;

    this.player.angle += e.movementX * this.mouseSensitivity;
    this.player.angle = this.normalizeAngle(this.player.angle);
  }

  restartGame() {
    this.currentLevel = 1;
    this.started = true;
    this.paused = false;
    this.win = false;
    this.gameOver = false;

    this.deathAlpha = 0;
    this.deathPulse = 0;

    this.recoil = 0;
    this.flash = 0;
    this.hitFlash = 0;
    this.damageFlash = 0;
    this.weaponBob = 0;
    this.gunKick = 0;
    this.gunSide = 0;
    this.screenShake = 0;
    this.cameraShakeX = 0;
    this.cameraShakeY = 0;

    this.currentWeaponFrame = 0;
    this.weaponAnimTimer = 0;

    this.player.spawn();

    this.enemies = [
      new Enemy(300, 300),
      new Enemy(500, 200),
      new Enemy(420, 500)
    ];
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  update(deltaTime) {
    if (this.weaponAnimTimer > 0) {
      this.weaponAnimTimer -= 1 * deltaTime;
      if (this.weaponAnimTimer <= 0) {
        this.weaponAnimTimer = 0;
        this.currentWeaponFrame = 0;
      }
    }

    if (this.paused) return;

    if (!this.gameOver && !this.win) {
      this.player.update(this.input.keys, deltaTime);
      this.player.angle = this.normalizeAngle(this.player.angle);

      const moving =
        this.input.keys["w"] ||
        this.input.keys["s"] ||
        this.input.keys["q"] ||
        this.input.keys["e"] ||
        this.input.keys["a"] ||
        this.input.keys["d"] ||
        this.input.keys["arrowup"] ||
        this.input.keys["arrowdown"];

      if (moving) {
        this.weaponBob += 0.12 * deltaTime;
      }

      if (this.input.keys.shoot) {
        if (this.player.ammo > 0) {
          this.player.ammo--;
          this.recoil = 12;
          this.gunKick = 16;
          this.gunSide = (Math.random() - 0.5) * 8;
          this.flash = 1;
          this.screenShake = 7;
          this.shoot();
        }
        this.input.keys.shoot = false;
      }

      this.updateEnemies(deltaTime);
      this.checkExit();

      if (this.player.health <= 0) {
        this.player.health = 0;
        this.gameOver = true;
        document.exitPointerLock?.();
      }
    } else if (this.gameOver) {
      this.deathAlpha = Math.min(0.82, this.deathAlpha + 0.02 * deltaTime);
      this.deathPulse += 0.08 * deltaTime;
    }

    this.recoil *= 0.82;
    this.gunKick *= 0.78;
    this.gunSide *= 0.78;
    this.flash *= 0.78;
    this.hitFlash *= 0.84;
    this.damageFlash *= 0.9;
    this.screenShake *= 0.75;

    this.cameraShakeX = (Math.random() - 0.5) * this.screenShake;
    this.cameraShakeY = (Math.random() - 0.5) * this.screenShake;
  }

  updateEnemies(deltaTime) {
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;

      enemy.update(deltaTime);

      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) return;
      if (distance > enemy.chaseRange) return;

      if (distance > enemy.attackRange) {
        const speed = enemy.speed * deltaTime;

        const dirX = dx / distance;
        const dirY = dy / distance;

        const newX = enemy.x + dirX * speed;
        const newY = enemy.y + dirY * speed;

        const mapX = Math.floor(newX / TILE_SIZE);
        const mapY = Math.floor(newY / TILE_SIZE);

        if (MAP[mapY] && MAP[mapY][mapX] !== 1) {
          enemy.x = newX;
          enemy.y = newY;
        }
      }

      if (distance <= enemy.attackRange && enemy.attackCooldown <= 0) {
        const damage = 8;
        this.player.health = Math.max(0, this.player.health - damage);
        this.damageFlash = 0.45;
        this.screenShake = 10;
        enemy.attackCooldown = 35;
      }
    });
  }

  shoot() {
    this.currentWeaponFrame = 1;
    this.weaponAnimTimer = 5;

    const angle = this.player.angle;
    let hitSomething = false;

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const enemyAngle = Math.atan2(dy, dx);
      const diff = Math.abs(this.normalizeAngle(angle - enemyAngle));

      if (diff < 0.14 && distance < 420) {
        enemy.takeDamage(1);
        this.hitFlash = 1;
        this.recoil = 14;
        this.gunKick = 18;
        this.screenShake = 9;

        const knockback = 10;
        enemy.x += Math.cos(angle) * knockback;
        enemy.y += Math.sin(angle) * knockback;

        hitSomething = true;
      }
    });

    if (!hitSomething) {
      this.screenShake = 5;
    }
  }

  normalizeAngle(angle) {
    angle = angle % (Math.PI * 2);
    if (angle < -Math.PI) angle += Math.PI * 2;
    if (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
  }

  checkExit() {
    const mapX = Math.floor(this.player.x / TILE_SIZE);
    const mapY = Math.floor(this.player.y / TILE_SIZE);

    if (MAP[mapY] && MAP[mapY][mapX] === 2) {
      const aliveEnemies = this.enemies.filter((e) => e.alive).length;

      if (aliveEnemies === 0) {
        this.nextLevel();
      }
    }
  }

  nextLevel() {
    if (this.currentLevel === 1) {
      this.currentLevel = 2;

      for (let y = 0; y < LEVEL2.length; y++) {
        MAP[y] = [...LEVEL2[y]];
      }

      this.player.spawn();

      this.enemies = [
        new Enemy(200, 200),
        new Enemy(300, 300),
        new Enemy(400, 200)
      ];
    } else {
      this.win = true;
    }
  }

  render() {
    this.ctx.save();
    this.ctx.translate(this.cameraShakeX, this.cameraShakeY);

    this.drawBackground();
    this.raycaster.castRays();
    this.drawEnemies();
    this.drawMinimap();
    this.drawCrosshair();
    this.drawHUD();

    if (this.flash > 0.05) {
      this.drawMuzzleFlash();
    }

    this.drawGun();

    if (this.hitFlash > 0.03) {
      this.drawHitFlash();
    }

    if (this.damageFlash > 0.03) {
      this.drawDamageOverlay();
    }

    if (!this.started) {
      this.drawStartScreen();
    }

    if (this.paused && !this.gameOver && !this.win) {
      this.drawPauseScreen();
    }

    if (this.gameOver) {
      this.drawGameOver();
    }

    if (this.win) {
      this.drawWinScreen();
    }

    this.ctx.restore();
  }

  drawBackground() {
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height / 2);
    skyGradient.addColorStop(0, "#0b1020");
    skyGradient.addColorStop(1, "#1f2d55");

    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);

    const floorGradient = this.ctx.createLinearGradient(0, this.canvas.height / 2, 0, this.canvas.height);
    floorGradient.addColorStop(0, "#1a1a1a");
    floorGradient.addColorStop(1, "#050505");

    this.ctx.fillStyle = floorGradient;
    this.ctx.fillRect(0, this.canvas.height / 2, this.canvas.width, this.canvas.height / 2);
  }

  drawEnemies() {
    const visibleEnemies = [];

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const angleToEnemy = this.normalizeAngle(
        Math.atan2(dy, dx) - this.player.angle
      );

      if (Math.abs(angleToEnemy) > this.raycaster.fov / 2 + 0.2) return;

      visibleEnemies.push({ enemy, distance, angleToEnemy });
    });

    visibleEnemies.sort((a, b) => b.distance - a.distance);

    visibleEnemies.forEach(({ enemy, distance, angleToEnemy }) => {
      const size = Math.max(24, 12000 / distance);

      const screenX =
        this.canvas.width / 2 +
        Math.tan(angleToEnemy) * (this.canvas.width / 2) -
        size / 2;

      const screenY = this.canvas.height / 2 - size / 2;

      if (this.enemySprite.complete && this.enemySprite.naturalWidth > 0) {
        this.ctx.save();

        if (enemy.hitTimer > 0) {
          this.ctx.globalAlpha = 0.75;
        }

        this.ctx.drawImage(
          this.enemySprite,
          screenX,
          screenY,
          size,
          size
        );

        if (enemy.hitTimer > 0) {
          this.ctx.fillStyle = "rgba(255,255,255,0.35)";
          this.ctx.fillRect(screenX, screenY, size, size);
        }

        this.ctx.restore();
      } else {
        this.ctx.fillStyle = "#4a0000";
        this.ctx.fillRect(screenX, screenY, size, size);

        this.ctx.fillStyle = enemy.hitTimer > 0 ? "#ffffff" : "#8b0000";
        this.ctx.fillRect(
          screenX + size * 0.1,
          screenY + size * 0.2,
          size * 0.8,
          size * 0.75
        );

        this.ctx.fillStyle = enemy.hitTimer > 0 ? "#ffeeee" : "#ff4444";
        this.ctx.fillRect(
          screenX + size * 0.25,
          screenY,
          size * 0.5,
          size * 0.3
        );
      }

      this.ctx.fillStyle = "rgba(0,0,0,0.7)";
      this.ctx.fillRect(screenX, screenY - 12, size, 6);

      this.ctx.fillStyle = "#ff2222";
      this.ctx.fillRect(screenX, screenY - 12, size, 6);

      this.ctx.fillStyle = "#00ff66";
      this.ctx.fillRect(
        screenX,
        screenY - 12,
        size * (enemy.health / 3),
        6
      );
    });
  }

  drawCrosshair() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.save();

    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1.5;

    this.ctx.beginPath();
    this.ctx.moveTo(cx - 6, cy);
    this.ctx.lineTo(cx + 6, cy);
    this.ctx.moveTo(cx, cy - 6);
    this.ctx.lineTo(cx, cy + 6);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fill();

    this.ctx.restore();
  }

  drawHUD() {
    const aliveCount = this.enemies.filter((enemy) => enemy.alive).length;

    this.ctx.save();

    this.ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    this.ctx.fillRect(16, this.canvas.height - 92, 420, 72);

    this.ctx.strokeStyle = "rgba(255,255,255,0.15)";
    this.ctx.strokeRect(16, this.canvas.height - 92, 420, 72);

    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "bold 22px Arial";
    this.ctx.fillText(`VIDA: ${Math.floor(this.player.health)}`, 30, this.canvas.height - 52);
    this.ctx.fillText(`MUNIÇÃO: ${this.player.ammo}`, 30, this.canvas.height - 22);
    this.ctx.fillText(`INIMIGOS: ${aliveCount}`, 190, this.canvas.height - 22);

    if (aliveCount === 0) {
      this.ctx.fillStyle = "#00ff88";
      this.ctx.fillText("SAÍDA LIBERADA", 290, this.canvas.height - 52);
    } else {
      this.ctx.fillStyle = "#ffcc00";
      this.ctx.fillText("MATE TODOS", 290, this.canvas.height - 52);
    }

    this.ctx.restore();
  }

  drawGun() {
    if (!this.weaponSheet.complete) return;
  
    const x = this.canvas.width / 2;
    const bob = Math.sin(this.weaponBob) * 4;
    const y = this.canvas.height - 10 + this.recoil + this.gunKick + bob;
  
    this.ctx.drawImage(
      this.weaponSheet,
      x - 150,
      y - 300,
      300,
      300
    );
  }

  drawMuzzleFlash() {
    this.ctx.save();

    this.ctx.fillStyle = `rgba(255,240,180,${this.flash})`;
    this.ctx.beginPath();
    this.ctx.arc(
      this.canvas.width / 2 + this.gunSide,
      this.canvas.height - 135 + this.gunKick,
      50,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    this.ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.25})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.restore();
  }

  drawHitFlash() {
    this.ctx.save();
    this.ctx.fillStyle = `rgba(255,255,255,${this.hitFlash * 0.15})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = `rgba(255,0,0,${this.hitFlash * 0.18})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawDamageOverlay() {
    this.ctx.save();
    this.ctx.fillStyle = `rgba(255,0,0,${this.damageFlash})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawGameOver() {
    const pulse = (Math.sin(this.deathPulse) + 1) / 2;
    const redGlow = 0.18 + pulse * 0.18;

    this.ctx.fillStyle = `rgba(0,0,0,${this.deathAlpha})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = `rgba(160,0,0,${redGlow})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const grad = this.ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      80,
      this.canvas.width / 2,
      this.canvas.height / 2,
      Math.max(this.canvas.width, this.canvas.height) * 0.7
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.textAlign = "center";

    this.ctx.shadowColor = "rgba(255,0,0,0.9)";
    this.ctx.shadowBlur = 24;
    this.ctx.fillStyle = "#ff2a2a";
    this.ctx.font = "bold 72px Arial";
    this.ctx.fillText("VOCÊ MORREU", this.canvas.width / 2, this.canvas.height / 2 - 10);

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = "rgba(255,255,255,0.92)";
    this.ctx.font = "22px Arial";
    this.ctx.fillText("Clique para reiniciar", this.canvas.width / 2, this.canvas.height / 2 + 42);

    this.ctx.fillStyle = "rgba(255,255,255,0.6)";
    this.ctx.font = "18px Arial";
    this.ctx.fillText("Pressione ESC para soltar o mouse", this.canvas.width / 2, this.canvas.height / 2 + 78);

    this.ctx.restore();
  }

  drawMinimap() {
    const scale = 0.2;
    const tileSize = TILE_SIZE * scale;
    const mapOffsetX = 20;
    const mapOffsetY = 20;

    this.ctx.save();
    this.ctx.globalAlpha = 0.95;
    this.ctx.fillStyle = "rgba(0,0,0,0.45)";
    this.ctx.fillRect(
      mapOffsetX - 8,
      mapOffsetY - 8,
      MAP[0].length * tileSize + 16,
      MAP.length * tileSize + 16
    );

    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        if (MAP[y][x] === 1) {
          this.ctx.fillStyle = "#cfcfcf";
        } else if (MAP[y][x] === 2) {
          this.ctx.fillStyle = "#00ff88";
        } else {
          this.ctx.fillStyle = "#202020";
        }

        this.ctx.fillRect(
          mapOffsetX + x * tileSize,
          mapOffsetY + y * tileSize,
          tileSize - 1,
          tileSize - 1
        );
      }
    }

    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;

      const ex = mapOffsetX + (enemy.x / TILE_SIZE) * tileSize;
      const ey = mapOffsetY + (enemy.y / TILE_SIZE) * tileSize;

      this.ctx.fillStyle = "#ff3333";
      this.ctx.beginPath();
      this.ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      this.ctx.fill();
    });

    const px = mapOffsetX + (this.player.x / TILE_SIZE) * tileSize;
    const py = mapOffsetY + (this.player.y / TILE_SIZE) * tileSize;

    this.ctx.fillStyle = "#00ff88";
    this.ctx.beginPath();
    this.ctx.arc(px, py, 4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = "#00ff88";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(px, py);
    this.ctx.lineTo(
      px + Math.cos(this.player.angle) * 18,
      py + Math.sin(this.player.angle) * 18
    );
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawStartScreen() {
    const ctx = this.ctx;

    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#000000");
    gradient.addColorStop(1, "#1a0000");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.textAlign = "center";

    ctx.fillStyle = "#ff2a2a";
    ctx.font = "bold 80px Arial";
    ctx.fillText("DOOM CLONE", this.canvas.width / 2, this.canvas.height / 2 - 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Arial";
    ctx.fillText("PRESSIONE ENTER", this.canvas.width / 2, this.canvas.height / 2 + 20);

    ctx.font = "18px Arial";
    ctx.fillText("WASD • Mouse • Clique", this.canvas.width / 2, this.canvas.height / 2 + 60);
  }

  drawPauseScreen() {
    this.ctx.fillStyle = "rgba(0,0,0,0.55)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "bold 58px Arial";
    this.ctx.fillText("PAUSADO", this.canvas.width / 2, this.canvas.height / 2);

    this.ctx.font = "22px Arial";
    this.ctx.fillText("Pressione ESC para voltar", this.canvas.width / 2, this.canvas.height / 2 + 42);
  }

  drawWinScreen() {
    this.ctx.fillStyle = "rgba(0,0,0,0.72)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "#00ff88";
    this.ctx.font = "bold 64px Arial";
    this.ctx.fillText("VOCÊ VENCEU", this.canvas.width / 2, this.canvas.height / 2 - 10);

    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "22px Arial";
    this.ctx.fillText("Clique para jogar novamente", this.canvas.width / 2, this.canvas.height / 2 + 36);
  }

  loop = (currentTime = 0) => {
    this.deltaTime = (currentTime - this.lastTime) / 16.6667;
    this.lastTime = currentTime;

    this.update(this.deltaTime || 1);
    this.render();

    requestAnimationFrame(this.loop);
  };

  start() {
    requestAnimationFrame(this.loop);
  }
}