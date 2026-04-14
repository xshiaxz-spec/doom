import { MAP, TILE_SIZE } from "./world/map.js";

export class Raycaster {
  constructor(ctx, canvas, player) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.player = player;

    this.fov = Math.PI / 3;
    this.maxDepth = 1200;

    this.wallTexture = new Image();
    this.wallTexture.src = "./assets/textures/wall.png";

    this.handleResize();
  }

  handleResize() {
    this.numRays = Math.max(120, Math.floor(this.canvas.width / 2));
    this.columnWidth = this.canvas.width / this.numRays;
  }

  castRays() {
    this.zBuffer = [];
  
    for (let col = 0; col < this.numRays; col++) {
      const rayAngle = this.player.angle - this.fov / 2 + (col / this.numRays) * this.fov;
  
      const hit = this.castSingleRay(rayAngle);
  
      const correctedDistance = hit.distance * Math.cos(rayAngle - this.player.angle);
  
      this.zBuffer[col] = correctedDistance;
  
      const wallHeight = (this.tileSize / correctedDistance) * this.projPlane;
  
      this.ctx.fillStyle = hit.color || "#888";
      this.ctx.fillRect(
        col * this.stripWidth,
        this.canvas.height / 2 - wallHeight / 2,
        this.stripWidth + 1,
        wallHeight
      );
    }
  }

  castSingleRay(angle) {
    let depth = 0;
    let lastTileX = Math.floor(this.player.x / TILE_SIZE);
    let lastTileY = Math.floor(this.player.y / TILE_SIZE);

    while (depth < this.maxDepth) {
      const targetX = this.player.x + Math.cos(angle) * depth;
      const targetY = this.player.y + Math.sin(angle) * depth;

      const mapX = Math.floor(targetX / TILE_SIZE);
      const mapY = Math.floor(targetY / TILE_SIZE);

      if (
        mapX < 0 ||
        mapY < 0 ||
        mapY >= MAP.length ||
        mapX >= MAP[0].length
      ) {
        return {
          distance: this.maxDepth,
          side: "vertical",
          hitX: targetX,
          hitY: targetY,
        };
      }

      if (MAP[mapY][mapX] !== 0) {
        const side = mapX !== lastTileX ? "vertical" : "horizontal";

        return {
          distance: depth,
          side,
          hitX: targetX,
          hitY: targetY,
        };
      }

      lastTileX = mapX;
      lastTileY = mapY;
      depth += 1;
    }

    return {
      distance: this.maxDepth,
      side: "vertical",
      hitX: this.player.x,
      hitY: this.player.y,
    };
  }

  drawWallColumn(x, y, width, height, distance, side, hitX, hitY) {
    const textureCoord = side === "vertical" ? hitY : hitX;
    let textureX = Math.floor(textureCoord % TILE_SIZE);

    if (textureX < 0) textureX += TILE_SIZE;

    if (this.wallTexture.complete && this.wallTexture.naturalWidth > 0) {
      this.ctx.drawImage(
        this.wallTexture,
        textureX,
        0,
        1,
        this.wallTexture.height,
        x,
        y,
        width,
        height
      );
    } else {
      const shade = Math.max(40, 255 - distance * 0.22);
      const sideFactor = side === "vertical" ? 0.82 : 1;
      const r = Math.floor(shade * sideFactor);
      const g = Math.floor(shade * sideFactor);
      const b = Math.floor(shade * sideFactor);

      this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      this.ctx.fillRect(x, y, width, height);
    }

    const sideShadow = side === "vertical" ? 0.12 : 0.03;
    const distanceShadow = Math.min(0.78, distance / 700);

    this.ctx.fillStyle = `rgba(0,0,0,${distanceShadow + sideShadow})`;
    this.ctx.fillRect(x, y, width, height);

    this.ctx.fillStyle = "rgba(255,255,255,0.04)";
    this.ctx.fillRect(x, y, width, 2);
  }
}