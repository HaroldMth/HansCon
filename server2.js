const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

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
    <h1>Hans Chat</h1>
    <ul>
      ${rooms.map(room => `<li><a href="/room/${room.name}">${room.name}</a></li>`).join('')}
      <li><button onclick="window.location.href='/create-room'">+ Create Room</button></li>
    </ul>
  `);
});

// Route to create a new room
app.get('/create-room', (req, res) => {
  res.send(`
    <h1>Create a New Room</h1>
    <form action="/create-room" method="POST">
      <input type="text" name="name" placeholder="Room Name" required>
      <input type="password" name="password" placeholder="Room Password" required>
      <button type="submit">Create Room</button>
    </form>
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
    <h1>${roomName} Chat</h1>
    <form action="/room/${roomName}" method="POST">
      <input type="text" name="username" placeholder="Username" required>
      <input type="password" name="password" placeholder="Room Password" required>
      <button type="submit">Enter Room</button>
    </form>
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
    <h1>${roomName} Chat</h1>
    <div id="chat-messages">
      ${chatMessages.filter(msg => msg.room === roomName).map(msg => `<p><strong>${msg.username}:</strong> ${msg.message}</p>`).join('')}
    </div>
    <form action="/chat/${roomName}/${username}" method="POST">
      <input type="text" name="message" placeholder="Type a message" required>
      <button type="submit">Send</button>
    </form>
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
