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
                isOnSlope: false,
                primary_color:"Blue"};
var blue_status = {
                name:"blue",
                score:0,
                isOnSlope: false,
                primary_color:"Blue"};


// const server = net.createServer((c) => {
//   // 'connection' listener.
//   console.log('client connected');
//   c.on('end', () => {
//     console.log('client disconnected');
//   });
//   c.write('hello\n');
// //   c.pipe(c);
// c.on("data", (data) => {console.log(data.toString())});
// });
// server.on('error', (err) => {
//   throw err;
// });
// server.listen(8124, () => {
//   console.log('server bound');
// });

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');


app.get('/', (req,res) => {
    res.render('index');
});

app.get('/red', (req,res) => {
    res.render('index');
});

app.use(express.static('public'));

const data_parser = (red,blue) => {
    return new Array(red,blue);
};

const updateScoreBoard = () => {
    io.of('/display').emit("update", data_parser(red_status, blue_status));
};



redio.on("connection", (socket) => {
    socket.join("red_judge");

    socket.on("change_score",(change,fn)=>{
        red_status.score += change;
        fn(red_status.score);
        socket.broadcast.to('red_judge').emit("update_score",red_status.score);
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

    socket.on("change_score",(change,fn)=>{
        blue_status.score += change;
        fn(blue_status.score);
        socket.broadcast.to('blue_judge').emit("update_score",blue_status.score);
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