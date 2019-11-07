var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

const redio = io.of('/red');
const blueio = io.of('/blue');
const displayio = io.of('/display');

const net = require('net');

var port = 3000;
var tcp_server_port_red = 8124;
var tcp_server_port_blue = 8100;

var red_status = {
                name:"red",
                score:0,
                low_score:0,
                high_score:0,
                cube_score:0,
                isStayOnSlope:0,
                isOnSlope: false,
                primary_color:"Blue"};


var blue_status = {
                name:"blue",
                score:0,
                low_score:0,
                high_score:0,
                cube_score:0,
                isStayOnSlope:0,
                isOnSlope: false,
                primary_color:"Blue"};

var red_data_packet = {
    name:"r",
    color:"r",
    isStable:false,
    isAvailable:false
};

var blue_data_packet = {
    name:"b",
    color:"b",
    isStable:false,
    isAvailable:false
};

const serializeBool = v => v? 'T' : 'F';
const serialize = packet => `${packet.name}${packet.color}` + 
    `${serializeBool(packet.isStable)}${serializeBool(packet.isAvailable)}`;

let sockets = [];
let intervals = [];
let receive_buffer = "";

const server_red = net.createServer();
const server_blue = net.createServer();

function server_handler(server,side = 'red')
{
    server.on('connection', (socket) => {
        console.log('CONNECTED:  ' + socket.remoteAddress + ' : ' + socket.remotePort);
    
        let interval = setInterval(()=>{
            socket.write(serialize(side === 'red' ? red_data_packet:blue_data_packet) + '\n');
        }, 50);
        let soc_obj = {socket:socket, interval:interval};
    
        sockets.push(soc_obj);
        console.log(sockets.length);
    
        socket.on('data', (data) => 
        {
            receive_buffer += data;
            if(receive_buffer.includes('\n'))
            {
                let array_received = receive_buffer.split('\n',2);
                if(array_received.length > 1)
                {
                    if(array_received[0][0] === '{' && array_received[0][array_received[0].length - 1] === '}')
                        console.log(array_received[0]);
                    receive_buffer = array_received[1];
                    receive_buffer += receive_buffer[receive_buffer.length - 1] == '}' ? '\n' : '';
                }
            }
            
        });
    
        socket.on('close', function() {
            let index = sockets.findIndex(function(o) {
                return o.socket.remoteAddress === socket.remoteAddress && o.socket.remotePort === socket.remotePort;
            })
            if (index !== -1) 
            {
                clearInterval(sockets[index].interval);
                sockets.splice(index, 1);
                console.log(sockets.length);
            }
            console.log('CLOSED: ' + socket.remoteAddress + ' ' + socket.remotePort);
        });
        socket.on('error', () => {
            console.log('error');
            socket.destroy();
        });
    });

    server.on('error', (err) => {
        throw err;
      });
}

server_handler(server_red,'red');
server_handler(server_blue, 'blue');

server_red.listen(tcp_server_port_red, () => {
  console.log('red server listen at port: ' + tcp_server_port_red);
});
server_blue.listen(tcp_server_port_blue, () => {
    console.log('blue server listen at port: ' + tcp_server_port_blue);
});

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');


app.get('/', (req,res) => {
    res.render('index');
});

app.get('/red', (req,res) => {
    res.render('judge', {side:'red'});
});

app.get('/blue', (req,res) => {
    res.render('judge', {side:'blue'});
});

app.use(express.static('public'));

const data_parser = (red,blue) => {
    return new Array(red,blue);
};

const updateScoreBoard = () => {
    io.of('/display').emit("update", data_parser(red_status, blue_status));
};

const updateJudgeBoard = (side="red") => {
    if(side==="red")
        io.of('/red').to('red_judge').emit("update",red_status);
    else
        io.of('/blue').to('blue_judge').emit("update",blue_status);
};

const updateAvailTime = (socket) => {
    socket.on('reset_time',() => {
        let isRed = false;
        let isBlue = false;
        if('red_judge' in socket.rooms) 
        {
            red_data_packet.isAvailable = true;
            isRed = true;
        }
        else if('blue_judge' in socket.rooms) 
        {
            blue_status.isAvailable = true;
            isBlue = true;
        }

        let total_time = 30;
        let red_index = intervals.findIndex((o) => {
            return 'red_judge' in o.socket.rooms;
        });
        let blue_index = intervals.findIndex((o) => {
            return 'blue_judge' in o.socket.rooms;
        });
        socket.to(Object.keys(socket.rooms)[1]).emit('update_time', total_time);
        socket.emit('update_time', total_time);

        if(red_index!==-1 && isRed)
        {
            clearInterval(intervals[red_index].count_down);
            intervals.splice(red_index,1);
        }
        
        if(blue_index!==-1 && isBlue)
        {
            clearInterval(intervals[blue_index].count_down);
            intervals.splice(blue_index,1);
        }
        let stored = {socket:socket,time:total_time};
        let count_down = setInterval(() => {
            stored.time--;

            socket.to(Object.keys(socket.rooms)[1]).emit('update_time', stored.time);
            socket.emit('update_time', stored.time);
            
            if(isRed) 
            {
                io.of('/display').emit("update_energy_time", 'red', stored.time);
                // console.log("redtime");
            }
            else if(isBlue) 
            {
                io.of('/display').emit("update_energy_time", 'blue', stored.time);
            }

            console.log(Object.keys(socket.rooms)[1] + ' '+stored.time);
            if(stored.time <= 0)
            {
                clearInterval(stored.count_down);
                if('red_judge' in socket.rooms) red_data_packet.isAvailable = false;
                else if('blue_judge' in socket.rooms) blue_status.isAvailable = false;
            }
        },1000);
        stored.count_down = count_down;
        intervals.push(stored);
    });
};


redio.on("connection", (socket) => {
    socket.join("red_judge");
    socket.emit('update', red_status);

    socket.on("change_score",(name ,change ,fn)=>{
        if(!(name in red_status))
            throw new Error('Can not find key: ' + name);
        red_status.score += change;
        red_status[name] += change;

        fn(red_status[name]); 
        console.log(red_status);
        updateJudgeBoard("red");
        updateScoreBoard();
    });

    socket.on("changeIsOnSlopeStatus", (status,fn) => {
        red_status.isOnSlope = status;
        fn(red_status.isOnSlope);
        socket.broadcast.to('red_judge').emit('updateIsOnSlopeStatus', red_status.isOnSlope);
        red_data_packet.isStable = red_status.isOnSlope;
        updateScoreBoard();
    });

    socket.on("change_color", (color) => {
        red_status.primary_color = color;
        red_data_packet.color = color[0].toLowerCase();
        updateScoreBoard();
    });

    updateAvailTime(socket);
    
});

blueio.on("connection", (socket) => {
    socket.join("blue_judge");
    socket.emit('update', blue_status);

    socket.on("change_score",(name ,change ,fn)=>{
        if(!(name in red_status))
            throw new Error('Can not find key: ' + blue_status);
        blue_status.score += change;
        blue_status[name] += change;

        fn(blue_status[name]);
        updateJudgeBoard("blue");
        updateScoreBoard();
    });

    socket.on("changeIsOnSlopeStatus", (status,fn) => {
        blue_status.isOnSlope = status;
        fn(blue_status.isOnSlope);
        socket.broadcast.to('blue_judge').emit('updateIsOnSlopeStatus', blue_status.isOnSlope);
        blue_data_packet.isStable = blue_status.isOnSlope;
        updateScoreBoard();
    });

    socket.on("change_color", (color) => {
        blue_status.primary_color = color;
        blue_data_packet.color = color[0].toLowerCase();
        updateScoreBoard();
    });
    
    updateAvailTime(socket);

});

displayio.on('connection' ,(socket) => {
    updateScoreBoard();
});

 
http.listen(port, function () {
    console.log('Started server on port ' + port);
});