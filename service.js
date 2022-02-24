'use strict';
const http = require("http"); //Burada binamızın oturacağı zemini söylüyoruz.
const express = require("express"); // Ve burada ise zemine dikeceğimiz binayı tanımlıyoruz(express bu binayı tamamen hazır bir şekilde bize veriyor).
const app = express(); // Bu tanımladığımız binayı artık çalıştırmaya başlıyoruz.
const server = http.createServer(app); // Çalıştırdığımız ve hazır olan binamızı http.create server ile zemine oturdup ikisini birleştiriyoruz ve böylece serverimiz full halde hazır oluyor.
const redis = require("redis");

var redisClient = redis.createClient({ host: "192.168.20.131", port: 6379 });

redisClient.connect();
redisClient.ping();
var nowRoom;
// console.log(redisClient);

redisClient.on("connect", async function () {
  console.log("Redis client bağlandı");

  io.on("connection", (socket) => {
    // join user's own room
    socket.join(socket.id);
    console.log("----------------\na user connected");

    socket.on("disconnect", async () => {
      console.log("SOCKET ID ",socket.id)
      let exitedUser = await redisClient.hGet("online-rooms",socket.id);
      let objUser = JSON.parse(exitedUser)
      redisClient.hDel("online-rooms", socket.id);
      redisClient.hSet("offline-rooms", objUser.roomName,JSON.stringify({date:Date.now(),"roomName":objUser.roomName,name:objUser.name,email:objUser.email}));
      let res = await redisClient.hGetAll("online-rooms");
      let res1 = await redisClient.hGetAll("offline-rooms");
      
      io.emit("online rooms", Object.values(res));
      io.emit("offline rooms", Object.values(res1));
    });

    socket.on("join", async (roomName,data) => {
      let objData = JSON.parse(data)

      console.log("join: " + roomName);

      console.log("SOCKET ID JOINED ",socket.id)
      socket.join(roomName);
      
      redisClient.hSet("online-rooms", socket.id, JSON.stringify({date:Date.now(),name:objData.name,email:objData.email,"roomName":roomName}));
      redisClient.hDel("offline-rooms", roomName);

      let onlineResponse = await redisClient.hGetAll("online-rooms");
      let offlineResponse = await redisClient.hGetAll("offline-rooms");
      
      console.log("\n******************\nACTIVE ROOMS ", onlineResponse);
      console.log("OFF ROOMS ", offlineResponse);

      io.emit("online rooms", Object.values(onlineResponse));
      io.emit("offline rooms", Object.values(offlineResponse));
    });

    async function getOldMessages(roomName){
      let a = await redisClient.hGetAll(roomName);
      let keys = Object.keys(a)

      for (let i = 1,index=0; i < Object.keys(a).length+1; i++,index++) {
        a[keys[index]] = JSON.parse(a[keys[index]])
      }
      
      io.to(roomName).emit("get message",a)
    }
    socket.on("join to room", async (roomName) => {
      socket.join(roomName);

      getOldMessages(roomName)

    })

    socket.on("support message", ({ message, roomName },senderData) => {
      let userName = JSON.parse(senderData).name
      console.log("here is support message " + message);
      io.to(roomName).emit("sup msg", message,userName);
      redisClient.hSet(roomName,Date.now(),JSON.stringify({message:message,name:userName,"sender":"support"}))
    });

    socket.on("message", ({ message, roomName },senderData) => {
      let userName = JSON.parse(senderData).name
      console.log(userName)
      console.log("message: " + message + " in " + roomName);
      io.to(roomName).emit("user msg", message,userName);
      redisClient.hSet(roomName,Date.now(),JSON.stringify({message:message,name:userName,"sender":"user"}))
    });

  });
});

redisClient.on("error", function (err) {
  console.log("Redis Clientda bir hata var " + err);
});

const io = require("socket.io")(server, {
  cors: {
    origins: ["http://localhost:4200", "http://localhost:4201"],
  },
});

app.get("/", (req, res) => {
  res.sendFile("./index.html", { root: __dirname });
});

const port = 8002; // Serverimizin dinleyeceği portu söylüyoruz.
server.listen(port, () => {
  // Bizim kurduğumuz server yapısının kapısının ismini bir üst satırda söylediğimiz porttan dinlemesini söylüyoruz.
  console.log("Server is listening on:" + port + " now..."); // Dinlediğinin kanıtı olarak ekrana yazdırıyoruz.
});
