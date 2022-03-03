const http = require("http"); //Burada binamızın oturacağı zemini söylüyoruz.
const express = require("express"); // Ve burada ise zemine dikeceğimiz binayı tanımlıyoruz(express bu binayı tamamen hazır bir şekilde bize veriyor).
const app = express(); // Bu tanımladığımız binayı artık çalıştırmaya başlıyoruz.
const server = http.createServer(app); // Çalıştırdığımız ve hazır olan binamızı http.create server ile zemine oturdup ikisini birleştiriyoruz ve böylece serverimiz full halde hazır oluyor.
const redis = require("redis");
const io = require("socket.io")(server, {
  cors: {
    origins: ["http://localhost:4200", "http://localhost:4201"],
  },
});

var redisClient = redis.createClient({ host: "192.168.20.131", port: 6379 });

redisClient.connect();
redisClient.ping();
var nowRoom;

redisClient.on("connect", async function () {
  console.log("Redis client bağlandı");

  io.on("connection", (socket) => {
    console.log("----------------\na user connected");

    socket.on("disconnect", async () => {
      console.log("SOCKET ID ", socket.id);
      let exitedUser = await redisClient.hGet("online-rooms", socket.id);
      let objUser = JSON.parse(exitedUser);
      redisClient.hDel("online-rooms", socket.id);
      redisClient.hSet(
        "offline-rooms",
        objUser.roomName,
        JSON.stringify({
          date: Date.now(),
          roomName: objUser.roomName,
          name: objUser.name,
          email: objUser.email,
        })
      );
      let onlineResponse = await redisClient.hGetAll("online-rooms");
      let offlineResponse = await redisClient.hGetAll("offline-rooms");

      let onResponse = await getEveryOneUnreadedMessageCount(onlineResponse);
      let offResponse = await getEveryOneUnreadedMessageCount(offlineResponse);

      io.emit("online rooms", Object.values(onResponse));
      io.emit("offline rooms", Object.values(offResponse));
    });

    socket.on("join", async (roomName, data) => {
      let objData = JSON.parse(data);

      console.log("join: " + roomName);

      console.log("SOCKET ID JOINED ", socket.id);
      socket.join(roomName);

      redisClient.hSet(
        "online-rooms",
        socket.id,
        JSON.stringify({
          date: Date.now(),
          name: objData.name,
          email: objData.email,
          roomName: roomName,
        })
      );
      redisClient.hDel("offline-rooms", roomName);

      let onlineResponse = await redisClient.hGetAll("online-rooms");
      let offlineResponse = await redisClient.hGetAll("offline-rooms");

      let onResponse = await getEveryOneUnreadedMessageCount(onlineResponse);
      let offResponse = await getEveryOneUnreadedMessageCount(offlineResponse);

      io.emit("online rooms", Object.values(onResponse));
      io.emit("offline rooms", Object.values(offResponse));
    });

    async function getEveryOneUnreadedMessageCount(onlineResponse) {

      let unreadedMessages = 1;
      let obj = {};

      let i = 0;
      for (const key in onlineResponse) {
        if (Object.hasOwnProperty.call(onlineResponse, key)) {
          obj[i] = JSON.parse(onlineResponse[key]);
          let datas = await redisClient.hGetAll(obj[i].roomName);

          for (const data in datas) {
            let objData = JSON.parse(datas[data]);
            if (
              Object.hasOwnProperty.call(datas, data) &&
              objData.readed == false
            ) {
              console.log(obj[i].unreadedCount);
              obj[i].unreadedCount = obj[i].unreadedCount==undefined?1:obj[i].unreadedCount + unreadedMessages
              
            }
          }
        }
        i++;
      }
      console.log(obj);
      return obj;
    }

    async function getOldMessages(roomName) {
      let a = await redisClient.hGetAll(roomName);
      let keys = Object.keys(a);

      for (let i = 1, index = 0; i < Object.keys(a).length + 1; i++, index++) {
        a[keys[index]] = JSON.parse(a[keys[index]]);
      }

      io.to(roomName).emit("get message", a);
    }

    socket.on("get old messages", (roomName) => {
      socket.leaveAll();
      socket.join(roomName);
      getOldMessages(roomName);
    });

    socket.on("join to room", async (roomName) => {
      socket.leaveAll();
      socket.join(roomName);
      getOldMessages(roomName);
    });

    socket.on("read user messages", async (room) => {
      let response = await readAllMessages(room);
      socket.emit("unreaded count update", response);
    });

    async function readAllMessages(room) {
      let datas = await redisClient.hGetAll(room.roomName);

      for (const data in datas) {
        if (Object.hasOwnProperty.call(datas, data)) {
          datas[data] = JSON.parse(datas[data]);
          datas[data].readed = true;
          redisClient.hSet(room.roomName, data, JSON.stringify(datas[data]));
        }
      }
      room.unreadedCount = 0;
      return room;
    }

    socket.on("is typing", (isTyping, roomName) => {
      console.log(isTyping, roomName);
      if (isTyping) {
        socket.to(roomName).emit("typing", true);
      } else {
        socket.to(roomName).emit("typing", false);
      }
    });

    socket.on("opened page", (roomName) => {
      nowRoom = roomName;
      console.log("NOW ROOM ", nowRoom);
    });

    socket.on("support message", ({ message, roomName }, senderData) => { 
      let userName = JSON.parse(senderData).name;
      console.log("here is support message " + message);
      io.to(roomName).emit("sup msg", message, userName);
      redisClient.hSet(
        roomName,
        Date.now(),
        JSON.stringify({
          message: message,
          name: userName,
          sender: "support",
          readed: false,
        })
      );
    });

    socket.on("message", ({ message, roomName }, senderData) => {
      let userName = JSON.parse(senderData).name;
      console.log(userName);
      console.log("message: " + message + " in " + roomName);
      io.to(roomName).emit("user msg", message, userName);
      redisClient.hSet(
        roomName,
        Date.now(),
        JSON.stringify({
          message: message,
          name: userName,
          sender: "user",
          readed: nowRoom == roomName ? true : false,
        })
      );
      console.log(roomName);
      if (nowRoom != roomName) {
        getOnePersonUnreadedMessages(roomName);
      }
    });

    async function getOnePersonUnreadedMessages(roomName) {
      let unreadedCount = 0;
      let messageRooms = await redisClient.hGetAll(roomName);
      console.log(messageRooms);
      for (const key in messageRooms) {
        if (Object.hasOwnProperty.call(messageRooms, key)) {
          let obj = JSON.parse(messageRooms[key]);
          if (obj.readed == false) unreadedCount++;
        }
      }

      io.emit("unreaded count update", {
        roomName: roomName,
        unreadedCount: unreadedCount,
      });
    }
  });
});

redisClient.on("error", function (err) {
  console.log("Redis Clientda bir hata var " + err);
});

app.get("/", (req, res) => {
  res.sendFile("./index.html", { root: __dirname });
});

const port = 8002; // Serverimizin dinleyeceği portu söylüyoruz.
server.listen(port, () => {
  // Bizim kurduğumuz server yapısının kapısının ismini bir üst satırda söylediğimiz porttan dinlemesini söylüyoruz.
  console.log("Server is listening on:" + port + " now..."); // Dinlediğinin kanıtı olarak ekrana yazdırıyoruz.
});
