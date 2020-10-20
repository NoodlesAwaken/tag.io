/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready

const PLAYER_RADIUS = 20;
const PLAYER_SPEED = 800;
const MAP_SIZE = 2000;
const CHASER = 0;
const RUNNER = 1;
const clientId = (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)).toUpperCase();

//const socket = io('http://10.0.2.2:3000');
const socket = io('http://localhost:3000');
//const socket = io('http://192.168.10.24:3000');
const dataStream = Rx.Observable.fromEvent(socket, 'data');
const clientStream = Rx.Observable.fromEvent(socket, 'user');
const powerStream = Rx.Observable.fromEvent(socket, 'powers');

const playMenu = document.getElementById('play-menu');
const playButton = document.getElementById('play-button');
const usernameInput = document.getElementById('username-input');

// Get the canvas graphics context
const canvas = document.getElementById('game-canvas');
const context = canvas.getContext('2d');

const chaserImg = new Image();
const runnerImg = new Image();
const powerUpA = new Image();
const powerUpB = new Image();

var PLAYER_DIRECTION = 0;
var LAST_UPDATED = Date.now();
var playerX;
var playerY;

var Other;              // other players [list]
var powerUps;           // power ups [list]

// Make the canvas fullscreen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.addEventListener('deviceready', onDeviceReady, false);

class Object {
    constructor(id, x, y, dir, speed, role) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.direction = dir;
        this.speed = speed;
        this.role = role;
    }

    update(dt) {
        this.x += dt * this.speed * Math.cos(this.direction);
        this.y += dt * this.speed * Math.sin(this.direction);
    }

    distanceTo(object) {
        const dx = this.x - object.x;
        const dy = this.y - object.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    setDirection(dir) {
      this.direction = dir;
    }

    serializeForUpdate() {
      return {
        id: this.id,
        role: this.role,
        x: this.x,
        y: this.y,
      };
    }
}

function onDeviceReady() {
    // Cordova is now initialized. Have fun!
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
}

function connectServer() {
    //dataStream.filter(data => data.id != clientId).subscribe(data => console.log(data));
}

function play(name) {
    
}

function initState() {
    chaserImg.src = "img/joker.png";
    runnerImg.src = "img/batman.png";
    powerUpA.src = "img/power_a.png";
    powerUpB.src = "img/power_b.png";
    playerX = Math.floor(Math.random() * 2001);
    playerY = Math.floor(Math.random() * 2001);
}

function startCapturingInput() {
    
}

Promise.all([connectServer()]).then(() => {
    usernameInput.focus();
    playButton.onclick = () => {
      // Play
      play(usernameInput.value);
      playMenu.classList.add('hidden');
      initState();
      startRendering();
      startCapturingInput();
  };
});



function renderPlayer(player, others) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const { x, y } = player;
    const canvasX = canvas.width / 2 - x;
    const canvasY = canvas.height / 2 - y;
    
    //context.save();
    //context.translate(canvasX, canvasY);

    context.beginPath();
    context.lineWidth = "2";
    context.strokeStyle = "white";
    context.rect(canvasX, canvasY, MAP_SIZE, MAP_SIZE);
    context.stroke();

    var img, coeff;
    if (player.role === CHASER) {
        img = chaserImg;
        coeff = 3;
    } else {
        img = runnerImg;
        coeff = 2;
    }
    
    context.drawImage(
    img,
    canvas.width / 2 - PLAYER_RADIUS,
    canvas.height / 2 - PLAYER_RADIUS,
    PLAYER_RADIUS * coeff,
    PLAYER_RADIUS * coeff,
    );
        
    renderPowerUps();
   
    renderOtherPlayers(others);
   
    //context.restore();
}

function renderOtherPlayers(players) {
    if (typeof players[0] === 'undefined' || players[0].length === 0) {
        return;
    }
    for (var key in players) {
        const relativeX = players[key].x - playerX;
        const relativeY = players[key].y - playerY;
        
        var img, coeff;
        if (players[key].role === CHASER) {
            img = chaserImg;
            coeff = 3;
        } else {
            img = runnerImg;
            coeff = 2;
        }

        context.drawImage(
        img,
        canvas.width / 2 - PLAYER_RADIUS + relativeX,
        canvas.height / 2 - PLAYER_RADIUS + relativeY,
        PLAYER_RADIUS * coeff,
        PLAYER_RADIUS * coeff,
        );
    }
}

function renderPowerUps() {
    if (typeof powerUps === 'undefined') {
        return;
    }
    for (var key in powerUps) {
        const relativeX = powerUps[key].x - playerX;
        const relativeY = powerUps[key].y - playerY;
        
        var img;
        if (powerUps[key].type) {
            img = powerUpA;
        } else {
            img = powerUpB;
        }
        
        context.drawImage(
        img,
        canvas.width / 2 - PLAYER_RADIUS + relativeX,
        canvas.height / 2 - PLAYER_RADIUS + relativeY,
        PLAYER_RADIUS * 2,
        PLAYER_RADIUS * 2,
        );
    }
}

function renderBackground(x, y) {
  const backgroundX = MAP_SIZE / 2 - x + canvas.width / 2;
  const backgroundY = MAP_SIZE / 2 - y + canvas.height / 2;
  const backgroundGradient = context.createRadialGradient(
    backgroundX,
    backgroundY,
    MAP_SIZE / 10,
    backgroundX,
    backgroundY,
    MAP_SIZE / 2,
  );
  backgroundGradient.addColorStop(0, 'black');
  backgroundGradient.addColorStop(1, 'gray');
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}
                   
                   
function getCurrentState() {
    var direction = PLAYER_DIRECTION;
    const now = Date.now();
    // seconds past since last update
    const dt = (now - LAST_UPDATED) / 1000;
    LAST_UPDATED = now;
    
    playerX = playerX + Math.cos(direction) * PLAYER_SPEED * dt;
    playerY = playerY + Math.sin(direction) * PLAYER_SPEED * dt;
    playerX = Math.min(Math.max(PLAYER_RADIUS, playerX), MAP_SIZE - PLAYER_RADIUS);
    playerY = Math.min(Math.max(PLAYER_RADIUS, playerY), MAP_SIZE - PLAYER_RADIUS);
    
    var player = new Object(clientId, playerX, playerY, direction, PLAYER_SPEED, CHASER);

    
    socket.emit('data', player);
    


    dataStream
    .filter(data => data.id != clientId)
    .subscribe(data => {
        Other = data;
    });
    
    powerStream
    .subscribe(data => {
        powerUps = data;
    });
    
            
    return {
      me: player,
      others: [Other],
    };
}

function render() {
  const { me, others } = getCurrentState();
  if (!me) {
    return;
  }

  // Draw background
  //renderBackground(me.x, me.y);

  // Draw all players
  renderPlayer(me, others);
  //renderOtherPlayers(others);
}


let renderInterval = null;
function startRendering() {
    renderInterval = setInterval(render, 1000 / 60);
}
function stopRendering() {
    clearInterval(renderInterval);
}
                               
                               
function onMouseInput(e) {
    handleInput(e.clientX, e.clientY);
}

function onTouchInput(e) {
        const touch = e.touches[0];
        handleInput(touch.clientX, touch.clientY);
}

function handleInput(x, y) {
        const dir = Math.atan2(y - window.innerHeight / 2, x - window.innerWidth / 2);
        updateDirection(dir);
}

function updateDirection(dir) {
        PLAYER_DIRECTION = dir;
}

function startCapturingInput() {
        window.addEventListener('mousemove', onMouseInput);
        window.addEventListener('click', onMouseInput);
        window.addEventListener('touchstart', onTouchInput);
        window.addEventListener('touchmove', onTouchInput);
}

function stopCapturingInput() {
        window.removeEventListener('mousemove', onMouseInput);
        window.removeEventListener('click', onMouseInput);
        window.removeEventListener('touchstart', onTouchInput);
        window.removeEventListener('touchmove', onTouchInput);
}
