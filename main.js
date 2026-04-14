import { Game } from "./src/game.js";

const canvas = document.getElementById("game");
const game = new Game(canvas);

game.start();