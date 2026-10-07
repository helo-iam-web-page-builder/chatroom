const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Serve frontend files from the 'public' folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Set up SQLite Database (creates chat.db locally)
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // Create messages table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// Listen for real-time user connections via Socket.io
io.on('connection', (socket) => {
  console.log('A user connected');

  // When a user joins, fetch past messages from the database and send them
  db.all(`SELECT username, message, timestamp FROM messages ORDER BY id ASC LIMIT 50`, [], (err, rows) => {
    if (err) {
      console.error(err);
    } else {
      socket.emit('load_history', rows);
    }
  });

  // Listen for new chat messages sent from any client
  socket.diDisconnect = () => console.log('User disconnected');
  
  socket.on('chat_message', (data) => {
    const { username, message } = data;

    // Save the message into the database
    db.run(`INSERT INTO messages (username, message) VALUES (?, ?)`, [username, message], function(err) {
      if (err) {
        return console.error(err.message);
      }
      // Broadcast the message (including database ID) to everyone connected
      io.emit('chat_message', { username, message, timestamp: new Date().toISOString() });
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});