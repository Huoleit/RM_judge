var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

const redio = io.of('/red');
const blueio = io.of('/blue');
const displayio = io.of('/display');

const net = require('net');

var port = 3000;

var red_status = {
                name:"red",
                score:0,
                low_score:0,
                high_score:0,
                cube_score:0,
                isStayOnSlope:0,
                isOnSlope: false,
                primary_color:"Blue"};

var blue_status = red_status;
blue_status.name = "blue";

// var blue_status = {
//                 name:"blue",
//                 score:0,
//                 low_score:0,
//                 high_score:0,
//                 cube_score:0,
//                 isStayOnSlope:false,
//                 isOnSlope: false,
//                 primary_color:"Blue"};


const server = net.createServer((c) => {
 
  console.log('client connected');
  c.on('end', () => {
    console.log('client disconnected');
  });
  c.write('hello\n');
  setInterval(()=>{
      c.write('alive');
  }, 3000);

c.on("data", (data) => {console.log(data.toString())});
});
server.on('error', (err) => {
  throw err;
});
server.listen(8124, () => {
  console.log('server bound');
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

// const change_member_data = (name,change,_status) => {
//     switch(name)
//     {
//         case "low_score":
//             _status.low_score += change;
//             return _status.low_score;

//         case 'high_score':
//             _status.high_score += change;
//             return _status.high_score;
            
//         case 'isStayOnSlope':
//             _status.isStayOnSlope += change;
//             return _status.isStayOnSlope;

//         default: 
//             console.log("Cannot find member name")
//         return null;
//     }

// };


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
        updateScoreBoard();
    });
    
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
        updateScoreBoard();
    });
    
});

displayio.on('connection' ,(socket) => {
    updateScoreBoard();
});

 
http.listen(port, function () {
    console.log('Started server on port ' + port);
});