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

// player's avatar size
const PLAYER_RADIUS = 20;
// player moves at the speed of pixels per second
const PLAYER_SPEED = 120;
// player is restricted within a square map with length of 1000
const MAP_SIZE = 1000;
// player 'it'
const CHASER = 0;
// player not 'it'
const RUNNER = 1;
// player's unique id
const clientId = (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)).toUpperCase();

// PLAYER STATUS
const POWER_ZERO = 0;
const POWER_ONE = 1;
const NORMAL = 2;


// modify acoording to user's own device specification
//const socket = io('http://10.0.2.2:3000');
const socket = io('http://localhost:3000');
//const socket = io('http://192.168.10.24:3000');

// receiving players information
const dataStream = Rx.Observable.fromEvent(socket, 'data');

// receiving power ups information
const powerStream = Rx.Observable.fromEvent(socket, 'powers');

// receiving power up consuming information
const consumeStream = Rx.Observable.fromEvent(socket, 'consume');

// receiving client ids information
const clientStream = Rx.Observable.fromEvent(socket, 'users');

// receiving client collision information
const collisionStream = Rx.Observable.fromEvent(socket, 'collision');

// DOM elements
const playMenu = document.getElementById('play-menu');
const playButton = document.getElementById('play-button');
const userRole = document.getElementById('userrole-input');

// Get the canvas graphics context
const canvas = document.getElementById('game-canvas');
const context = canvas.getContext('2d');

// rendering images
const chaserImg = new Image();
const runnerImg = new Image();
const powerUpA = new Image();
const powerUpB = new Image();
const effectA = new Image();
const effectB = new Image();

// rendering interval will be set to 60 FPS once started
var renderInterval = null;

// player object
var PLAYER;

// compute update intervals
var LAST_UPDATED = Date.now();

// activation time stamp
var POWER_ACTIVATED;

// other players [list]
var Other;
// power ups [list]
var powerUps;

// Make the canvas fullscreen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.addEventListener('deviceready', onDeviceReady, false);

// player object
class Object {
    constructor(id, x, y, dir, speed, role, status, scale) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.direction = dir;
        this.speed = speed;
        this.role = role;       // 0: Joker; 1: Batman
        this.status = status;   // 0/1: power up 2: normal
        this.scale = scale;
    }

    // update location
    update(dt) {
        this.x += dt * this.speed * Math.cos(this.direction);
        this.y += dt * this.speed * Math.sin(this.direction);
        
        this.x = Math.min(Math.max(PLAYER_RADIUS, this.x), MAP_SIZE - PLAYER_RADIUS);
        this.y = Math.min(Math.max(PLAYER_RADIUS, this.y), MAP_SIZE - PLAYER_RADIUS);
    }

    // update direction
    setDirection(dir) {
        this.direction = dir;
    }
}

function onDeviceReady() {
    // Cordova is now initialized. Have fun!
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
}

// initialize system
function initState() {
    socket.connect();
    
    var r;
    if (userRole.value === "it") r = CHASER;
    else r = RUNNER;
    
    PLAYER = new Object(clientId, 0, 0, 0, PLAYER_SPEED, r, NORMAL, 1);
    chaserImg.src = "img/joker.png";
    runnerImg.src = "img/batman.png";
    powerUpA.src = "img/power_a.png";
    powerUpB.src = "img/power_b.png";
    effectA.src = "img/effect_a.png";
    effectB.src = "img/effect_b.png";
    
    PLAYER.x = Math.floor(Math.random() * 1900) + 50;
    PLAYER.y = Math.floor(Math.random() * 1900) + 50;
    
    // observe power up consumption
    consumeStream
    .filter(data => data.id === clientId)
    .subscribe(data => {
        PLAYER.status = data.type;
        POWER_ACTIVATED = Date.now();
    });
    
    // runner gets caught by chaser: become a chaser
    collisionStream
    .filter(data => data.first === clientId)
    .filter(data => data.firstRole === RUNNER)
    .filter(data => data.secondRole === CHASER)
    .filter(data => data.firstStatus !== POWER_ZERO)
    .subscribe(data => {
        PLAYER.role = CHASER;
    });
    
    // chaser gets caught by runner (power up 0): kick out of game
    collisionStream
    .filter(data => data.first === clientId)
    .filter(data => data.firstRole === CHASER)
    .filter(data => data.secondRole === RUNNER)
    .filter(data => data.secondStatus === POWER_ZERO)
    .subscribe(data => {
        socket.disconnect();
        context.clearRect(0, 0, canvas.width, canvas.height);
        stopCapturingInput();
        stopRendering();
        playMenu.classList.remove('hidden');
    });
}

// draw grid for the user movement as reference
function renderGrid() {
    const gridWidth = 80;
    const rows = Math.floor(canvas.height / gridWidth);
    const cols = Math.floor(canvas.width / gridWidth);
    var gridY = PLAYER.y % gridWidth;
    var gridX = PLAYER.x % gridWidth;
    context.lineWidth = "1";
    context.strokeStyle = "gray";
    for (var i = 1; i < rows + 1; i++) {
        context.beginPath();
        context.moveTo(0, gridWidth * i - gridY);
        context.lineTo(canvas.width, gridWidth * i - gridY);
        context.stroke();
    }
                            
    for (var j = 1; j < cols + 1; j++) {
        context.beginPath();
        context.moveTo(gridWidth * j - gridX, 0);
        context.lineTo(gridWidth * j - gridX, canvas.height);
        context.stroke();
    }
}

// render players, power ups, grid, game borders
function renderPlayer(player, others) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const { x, y } = player;
    const canvasX = canvas.width / 2 - x;
    const canvasY = canvas.height / 2 - y;
        
    renderGrid();
    
    context.beginPath();
    context.lineWidth = "2";
    context.strokeStyle = "white";
    context.rect(canvasX, canvasY, MAP_SIZE, MAP_SIZE);
    context.stroke();
    
    renderPowerUps();
   
    renderOtherPlayers(others);

    var img;
    if (player.role === CHASER) {
        img = chaserImg;
    } else {
        img = runnerImg;
    }

    // draw power up effect if possess any
    if (player.status === POWER_ONE) {
        context.drawImage(
        effectA,
        canvas.width / 2 - 1.5 * PLAYER_RADIUS * PLAYER.scale,
        canvas.height / 2 - 1.5 * PLAYER_RADIUS * PLAYER.scale,
        PLAYER_RADIUS * 3 * PLAYER.scale,
        PLAYER_RADIUS * 3 * PLAYER.scale,
        );
    } else if (player.status === POWER_ZERO) {
        context.drawImage(
        effectB,
        canvas.width / 2 - 1.5 * PLAYER_RADIUS,
        canvas.height / 2 - 1.5 * PLAYER_RADIUS,
        PLAYER_RADIUS * 3,
        PLAYER_RADIUS * 3,
        );
    }
        
    // draw player the last so it appear on top of others
    context.drawImage(
    img,
    canvas.width / 2 - PLAYER_RADIUS * PLAYER.scale,
    canvas.height / 2 - PLAYER_RADIUS * PLAYER.scale,
    PLAYER_RADIUS * 2 * PLAYER.scale,
    PLAYER_RADIUS * 2 * PLAYER.scale,
    );
}

// render other players with power ups
function renderOtherPlayers(players) {
    if (typeof players === 'undefined' || players.length === 0) {
        return;
    }
    for (var key in players) {
        // player is chaser with power 0: invisible
        if (players[key].role === CHASER && players[key].status === POWER_ZERO) continue;
        
        const relativeX = players[key].x - PLAYER.x;
        const relativeY = players[key].y - PLAYER.y;
        
        var img;
        if (players[key].role === CHASER) {
            img = chaserImg;
        } else {
            img = runnerImg;
        }
                       
        if (players[key].status === POWER_ONE) {
            context.drawImage(
            effectA,
            canvas.width / 2 - 1.5 * PLAYER_RADIUS * players[key].scale + relativeX,
            canvas.height / 2 - 1.5 * PLAYER_RADIUS * players[key].scale + relativeY,
            PLAYER_RADIUS * 3 * players[key].scale,
            PLAYER_RADIUS * 3 * players[key].scale,
            );
        } else if (players[key].status === POWER_ZERO) {
            context.drawImage(
            effectB,
            canvas.width / 2 - 1.5 * PLAYER_RADIUS + relativeX,
            canvas.height / 2 - 1.5 * PLAYER_RADIUS + relativeY,
            PLAYER_RADIUS * 3,
            PLAYER_RADIUS * 3,
            );
        }
        
        context.drawImage(
        img,
        canvas.width / 2 - PLAYER_RADIUS * players[key].scale + relativeX,
        canvas.height / 2 - PLAYER_RADIUS * players[key].scale + relativeY,
        PLAYER_RADIUS * 2 * players[key].scale,
        PLAYER_RADIUS * 2 * players[key].scale,
        );
    }
}

// redering power ups
function renderPowerUps() {
    if (typeof powerUps === 'undefined') {
        return;
    }
    for (var key in powerUps) {
        const relativeX = powerUps[key].x - PLAYER.x;
        const relativeY = powerUps[key].y - PLAYER.y;
        
        var img;
        if (powerUps[key].type) {
            img = powerUpA;     // 1: blue
        } else {
            img = powerUpB;     // 0: red
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

// update player current state then send to server
function getCurrentState() {
    const now = Date.now();
    // seconds past since last update
    const dt = (now - LAST_UPDATED) / 1000;
    LAST_UPDATED = now;
    
    // the power up only lasts 5 seconds
    if (now - POWER_ACTIVATED > 5000) PLAYER.status = NORMAL;
    
    if (PLAYER.status === POWER_ONE) {
        // runner receives power 1 will increase speed
        if (PLAYER.role === RUNNER) {
            PLAYER.speed = PLAYER_SPEED * 1.5;
        } else {    // chaser will increase size
            PLAYER.scale = 2;
        }
    } else {
        PLAYER.speed = PLAYER_SPEED;
        PLAYER.scale = 1;
    }
    
    
    PLAYER.update(dt);

    socket.emit('data', PLAYER);
        
   
    powerStream
    .subscribe(data => {
        powerUps = data;
    });
    
    clientStream
    .subscribe(data => {
        var list = [];
        for (var key in data) {
            if (data[key].id === clientId) continue;
            list.push(data[key]);
        }
        Other = list;
    });
    
            
    return {
        me: PLAYER,
        others: Other,
    };
}

function render() {
    const { me, others } = getCurrentState();
    if (!me) {
        return;
    }

    // Draw all players
    renderPlayer(me, others);
}

// 60 FPS
function startRendering() {
    renderInterval = setInterval(render, 1000 / 60);
}
                                 
function stopRendering() {
    clearInterval(renderInterval);
}
                               
function onMouseInput(e) {
    e.preventDefault();
    handleInput(e.clientX, e.clientY);
}

function onTouchInput(e) {
    e.preventDefault();
    const touch = e.touches[0];
    handleInput(touch.clientX, touch.clientY);
}

function handleInput(x, y) {
    const dir = Math.atan2(y - window.innerHeight / 2, x - window.innerWidth / 2);
    PLAYER.setDirection(dir);
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

// control flow
Promise.all([userRole.focus(), onDeviceReady()]).then(() => {
    playButton.onclick = () => {
        // Play
        playMenu.classList.add('hidden');
        initState();
        startRendering();
        startCapturingInput();
    };
});
