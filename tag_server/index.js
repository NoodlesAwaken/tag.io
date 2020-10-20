var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const MAX_PU = 2;           // maximum 2 power ups at a time
const PU_INT = 15;          // 15 seconds regeneration interval

var powerUpCounter = 0;
var connectCounter = 0;
var allClients = [];
var clientIds = [];
var powerUps = [];
var id;

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
        var puX = Math.floor(Math.random() * 1600) + 200;
        var puY = Math.floor(Math.random() * 1600) + 200;
        var powerUp;
        if (t) {           // power up 1
            powerUp = new PowerUp(1, puX, puY);
        } else {            // power up 0
            powerUp = new PowerUp(0, puX, puY);
        }
        powerUpCounter++;
        powerUps.push(powerUp);
    }
}

http.listen(3000, () => {
    console.log('listening on *:3000');
});

io.sockets.on('connection', function(socket) {
    allClients.push(socket);
    
    connectCounter++;
    console.log('new user connected');
    console.log('total connected users: ' + connectCounter);
    socket.on('data', (msg) => {
        io.emit('data', msg);
        id = msg.id;
        io.emit('users', clientIds);
        io.emit('powers', powerUps);
    });
    clientIds.push(id);

    socket.on('disconnect', function() {
        connectCounter--;
        console.log('user disconnected');
        console.log('total connected users: ' + connectCounter);

        var i = allClients.indexOf(socket);
        allClients.splice(i, 1);
        clientIds.splice(i, 1);
   });
});

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



