const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to serve static files (CSS, images, JS)
app.use(express.static('public'));

// Helper function to read a JSON file
const readJSONFile = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

// Helper function to write to a JSON file
const writeJSONFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Route to display rooms
app.get('/', (req, res) => {
  const rooms = readJSONFile('db1.json');
  res.send(`
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Hans Chat</h1>
      <div class="room-buttons">
        ${rooms.map(room => `<button onclick="window.location.href='/room/${room.name}'">${room.name}</button>`).join('')}
        <button onclick="window.location.href='/create-room'">+ Create Room</button>
      </div>
    </body>
    </html>
  `);
});

// Route to create a new room
app.get('/create-room', (req, res) => {
  res.send(`
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>Create a New Room</h1>
      <form action="/create-room" method="POST">
        <input type="text" name="name" placeholder="Room Name" required>
        <input type="password" name="password" placeholder="Room Password" required>
        <button type="submit">Create Room</button>
      </form>
    </body>
    </html>
  `);
});

app.post('/create-room', (req, res) => {
  const { name, password } = req.body;
  let rooms = readJSONFile('db1.json');

  // Check if room already exists
  let roomName = name;
  let counter = 1;
  while (rooms.some(room => room.name === roomName)) {
    roomName = `${name}-${counter}`;
    counter++;
  }

  // Add new room
  rooms.push({ name: roomName, password });
  writeJSONFile('db1.json', rooms);

  res.redirect('/');
});

// Route to enter a room
app.get('/room/:roomName', (req, res) => {
  const roomName = req.params.roomName;
  res.send(`
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>${roomName} Chat</h1>
      <form action="/room/${roomName}" method="POST">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Room Password" required>
        <button type="submit">Enter Room</button>
      </form>
    </body>
    </html>
  `);
});

app.post('/room/:roomName', (req, res) => {
  const roomName = req.params.roomName;
  const { username, password } = req.body;
  let rooms = readJSONFile('db1.json');
  const room = rooms.find(r => r.name === roomName);

  if (room && room.password === password) {
    res.redirect(`/chat/${roomName}/${username}`);
  } else {
    res.send('Invalid room or password. <a href="/">Back to rooms</a>');
  }
});

// Route to chat in a room
app.get('/chat/:roomName/:username', (req, res) => {
  const { roomName, username } = req.params;
  const chatMessages = readJSONFile('db2.json');
  res.send(`
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <h1>${roomName} Chat</h1>
      <div id="chat-messages">
        ${chatMessages.filter(msg => msg.room === roomName).map(msg => `<p><strong>${msg.username}:</strong> ${msg.message}</p>`).join('')}
      </div>
      <form action="/chat/${roomName}/${username}" method="POST">
        <input type="text" name="message" placeholder="Type a message" required>
        <button type="submit">Send</button>
      </form>
    </body>
    </html>
  `);
});

app.post('/chat/:roomName/:username', (req, res) => {
  const { roomName, username } = req.params;
  const { message } = req.body;
  let chatMessages = readJSONFile('db2.json');
  chatMessages.push({ room: roomName, username, message });
  writeJSONFile('db2.json', chatMessages);
  res.redirect(`/chat/${roomName}/${username}`);
});

const server = http.createServer(app);
const io = socketIO(server);

// In-memory store for online users
const onlineUsers = {};

// Socket.IO setup
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle user joining a room
  socket.on('join-room', ({ roomName, username }) => {
    // Ensure the room exists in the online users map
    if (!onlineUsers[roomName]) onlineUsers[roomName] = [];

    // Check if the username already exists in the room
    if (onlineUsers[roomName].includes(username)) {
      socket.emit('join-error', 'Username already taken in this room. Please choose another.');
      return;
    }

    // Add the user to the online list for the room
    onlineUsers[roomName].push(username);

    // Join the room
    socket.join(roomName);

    // Notify all users in the room about the updated online list
    io.to(roomName).emit('online-users', onlineUsers[roomName]);

    // Notify others in the room about the new user
    socket.to(roomName).emit('user-joined', `${username} has joined the room`);

    // Handle sending messages
    socket.on('send-message', (message) => {
      chatMessages.push({ room: roomName, username, message });
      writeJSONFile('db2.json', chatMessages);
      io.to(roomName).emit('new-message', { username, message });
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      onlineUsers[roomName] = onlineUsers[roomName].filter(user => user !== username);
      io.to(roomName).emit('online-users', onlineUsers[roomName]);
      io.to(roomName).emit('user-left', `${username} has left the room`);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
