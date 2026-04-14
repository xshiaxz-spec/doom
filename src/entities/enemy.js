export class Enemy {
    constructor(x, y) {
      this.x = x;
      this.y = y;
  
      this.alive = true;
      this.health = 3;
  
      this.hitTimer = 0;
  
      this.speed = 1.05;
      this.attackCooldown = 0;
      this.attackRange = 38;
      this.chaseRange = 420;
    }
  
    takeDamage(amount) {
      this.health -= amount;
      this.hitTimer = 10;
  
      if (this.health <= 0) {
        this.alive = false;
      }
    }
  
    update(deltaTime = 1) {
      if (this.hitTimer > 0) {
        this.hitTimer -= 1 * deltaTime;
        if (this.hitTimer < 0) this.hitTimer = 0;
      }
  
      if (this.attackCooldown > 0) {
        this.attackCooldown -= 1 * deltaTime;
        if (this.attackCooldown < 0) this.attackCooldown = 0;
      }
    }
  }