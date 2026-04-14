import { MAP, TILE_SIZE } from "../world/map.js";

export class Player {
  constructor() {
    this.spawn();
  }

  spawn() {
    this.x = TILE_SIZE * 1.5;
    this.y = TILE_SIZE * 1.5;
    this.angle = 0;

    this.moveSpeed = 2.8;
    this.rotSpeed = 0.045;
    this.radius = 10;

    this.health = 100;
    this.ammo = 50;
  }

  update(keys, deltaTime = 1) {
    const moveStep = this.moveSpeed * deltaTime;

    let direction = 0;
    if (keys["w"] || keys["arrowup"]) direction = 1;
    if (keys["s"] || keys["arrowdown"]) direction = -1;

    let strafe = 0;
    if (keys["a"] || keys["q"]) strafe = -1;
    if (keys["d"] || keys["e"]) strafe = 1;

    const forwardX = Math.cos(this.angle) * moveStep * direction;
    const forwardY = Math.sin(this.angle) * moveStep * direction;

    const strafeX = Math.cos(this.angle + Math.PI / 2) * moveStep * strafe;
    const strafeY = Math.sin(this.angle + Math.PI / 2) * moveStep * strafe;

    const newX = this.x + forwardX + strafeX;
    const newY = this.y + forwardY + strafeY;

    this.moveWithCollision(newX, newY);
  }

  moveWithCollision(newX, newY) {
    const margin = this.radius;

    if (!this.isWall(newX + margin, this.y) && !this.isWall(newX - margin, this.y)) {
      this.x = newX;
    }

    if (!this.isWall(this.x, newY + margin) && !this.isWall(this.x, newY - margin)) {
      this.y = newY;
    }
  }

  isWall(x, y) {
    const mapX = Math.floor(x / TILE_SIZE);
    const mapY = Math.floor(y / TILE_SIZE);

    if (
      mapX < 0 ||
      mapY < 0 ||
      mapY >= MAP.length ||
      mapX >= MAP[0].length
    ) {
      return true;
    }

    return MAP[mapY][mapX] === 1;
  }
}