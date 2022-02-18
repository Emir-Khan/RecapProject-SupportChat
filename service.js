const http = require("http"); //Burada binamızın oturacağı zemini söylüyoruz.
const express = require("express"); // Ve burada ise zemine dikeceğimiz binayı tanımlıyoruz(express bu binayı tamamen hazır bir şekilde bize veriyor).
const app = express(); // Bu tanımladığımız binayı artık çalıştırmaya başlıyoruz.
const server = http.createServer(app); // Çalıştırdığımız ve hazır olan binamızı http.create server ile zemine oturdup ikisini birleştiriyoruz ve böylece serverimiz full halde hazır oluyor.
const redis = require('redis');

var redisClient = redis.createClient({host:"192.168.20.131",port:6379})

redisClient.connect()
redisClient.ping()
var nowRoom;
// console.log(redisClient);

redisClient.on('connect', async function () {
    console.log('Redis client bağlandı');
    // redisClient.hSet('test1', 'deneme', "cookieId")
    // redisClient.hSet('test1', 'status', true)
    io.on("connection", (socket) => {
      // join user's own room
      socket.join(socket.id);
      console.log("----------------\na user connected");
    
      socket.on("disconnect", () => {
        console.log("user  disconnected");
        redisClient.hSet("offline-rooms",nowRoom,socket.id)
        // io.emit("offline person", rooms[socket.id]);
        
      });
    
      socket.on("support message", ({ message, roomName }) => {
        console.log("here is support message " + message);
        io.to(roomName).emit("sup msg", message);
      });
    
      socket.on("join", async (roomName) => {
        console.log("join: " + roomName);
        nowRoom=roomName
    
        socket.join(roomName);
    
        redisClient.hSet("online-rooms",roomName,socket.id,Date.now())
        redisClient.hDel("offline-rooms",roomName)
        //date ye göre sırala front endde
        let res = await redisClient.hGetAll("online-rooms")
        let res1 = await redisClient.hGetAll("offline-rooms")
        console.log(res);
        console.log("OFF ROOMS ", res1)
        console.log("NOW ROOM ",nowRoom)
        io.emit("online rooms", Object.keys(res));
      });
    
      socket.on("message", ({ message, roomName }) => {
        console.log("message: " + message + " in " + roomName);
        io.to(roomName).emit("user msg", message);
      });
    });
});
 
redisClient.on('error', function (err) {
    console.log('Redis Clientda bir hata var ' + err);
});

const io = require("socket.io")(server, {
  cors: {
    origins: ["http://localhost:4200", "http://localhost:4201"],
  },
});




app.get("/", (req, res) => {
  // res.setHeader('Access-Control-Allow-Origin', '*');
  // res.send('asasd');
  res.sendFile("./index.html", { root: __dirname });
});


const port = 8002; // Serverimizin dinleyeceği portu söylüyoruz.
server.listen(port, () => {
  // Bizim kurduğumuz server yapısının kapısının ismini bir üst satırda söylediğimiz porttan dinlemesini söylüyoruz.
  console.log("Server is listening on:" + port + " now..."); // Dinlediğinin kanıtı olarak ekrana yazdırıyoruz.
});
