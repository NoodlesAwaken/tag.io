const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const Rx = require('rx');

const MAX_PU = 2;           // maximum 2 power ups at a time
const PU_INT = 15;          // 15 seconds regeneration interval
const PLAYER_RADIUS = 20;

var powerUpCounter = 0;
var connectCounter = 0;

var sockets = {};           // socket list {}
var players = {};           // player list {}

var powerUps = [];
var id;

http.listen(3000, () => {
    console.log('listening on *:3000');
});

const connection = Rx.Observable.fromEvent(io, 'connection');

// broadcast to all clients: players and power up information
connection.subscribe(socket => {
    Rx
    .Observable
    .fromEvent(socket, 'data')
    .subscribe(data => {
        //io.emit('data', data);  // Emit to all clients
        io.emit('powers', powerUps);
        io.emit('users', players);
    });
});

// save all clients information in a list
connection.subscribe(socket => {
    Rx
    .Observable
    .fromEvent(socket, 'data')
    .subscribe(data => {
        players[socket.id] = data;
    });
});


// broadcast to all clients: client who picked up power up
connection.subscribe(socket => {
    Rx
    .Observable
    .fromEvent(socket, 'data')
    .subscribe(data => {
        for (var pu in powerUps) {
            var cx = data.x;
            var cy = data.y;
            const dx = powerUps[pu].x - cx;
            const dy = powerUps[pu].y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < PLAYER_RADIUS * data.scale + PLAYER_RADIUS) {     // hit
                console.log('Consumed a power up ' + powerUps[pu].type);
                io.emit('consume', {
                    id: data.id,
                    type: powerUps[pu].type
                });
                powerUps.splice(pu, 1);
                powerUpCounter--;
                // send message the client who hits it
                break;
            }
        }
    });
});

// broadcast to all clients: client who touched by others
connection.subscribe(socket => {
    Rx
    .Observable
    .fromEvent(socket, 'data')
    .subscribe(data => {
        var cx = data.x;
        var cy = data.y;
        for (var key in players) {
            const dx = players[key].x - cx;
            const dy = players[key].y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < PLAYER_RADIUS * (data.scale + players[key].scale) && data.id !== players[key].id) {     // hit
                //console.log('players collision!');
                io.emit('collision', {
                    first: data.id,
                    firstRole: data.role,
                    firstStatus: data.status,
                    second: players[key].id,
                    secondRole: players[key].role,
                    secondStatus: players[key].status
                });
                break;
            }
        }
    });
});


io.sockets.on('connection', function(socket) {
    // connecting
    sockets[socket.id] = socket;
    
    connectCounter++;
    console.log('Client connected');
    console.log('Total connected users: ' + connectCounter);

    // disconnecting
    socket.on('disconnect', function() {
        connectCounter--;
        console.log('Client disconnected');
        console.log('Total connected users: ' + connectCounter);

        delete sockets[socket.id];
        delete players[socket.id];
   });
});

class PowerUp {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
    }
}

setInterval(generatePowerUp, PU_INT * 1000);

// generate a power up
function generatePowerUp() {
    if (powerUpCounter < MAX_PU) {
        var t = Math.floor(Math.random() * 2);      // 0 or 1
        var puX = Math.floor(Math.random() * 600) + 200;
        var puY = Math.floor(Math.random() * 600) + 200;
        var powerUp;
        if (t) {           // power up 1
            powerUp = new PowerUp(1, puX, puY);
        } else {            // power up 0
            powerUp = new PowerUp(0, puX, puY);
        }
        powerUpCounter++;
        powerUps.push(powerUp);
        console.log('Generated a power up ' + t);
    }
}





const { networkInterfaces } = require('os');

const nets = networkInterfaces();
const results = Object.create(null); // or just '{}', an empty object

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        // skip over non-ipv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
            if (!results[name]) {
                results[name] = [];
            }

            results[name].push(net.address);
        }
    }
}

console.log(results["en0"][0]);

/*
io.on('connect', (socket) => {
    connectCounter++;
    console.log('new user connected');
    console.log('total connected users: ' + connectCounter);
    socket.on('data', (msg) => {
        io.emit('data', msg);
    });
});

io.on('disconnect', function() {
    connectCounter--;
    console.log('user disconnected');
    console.log('total connected users: ' + connectCounter);
});
 
 
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
*/



