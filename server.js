const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const fs = require('fs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, Date.now() + '.' + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true
  }
}));
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  console.log("SID:", req.sessionID);
  console.log("USER:", req.session.user);
  next();
});


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


app.get('/join', (req, res) => {
  res.sendFile(__dirname + '/join.html');
});


app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.post('/register', async (req, res) => {
  const { id, password } = req.body;
  const idRegex = /^[a-zA-Z가-힣]{1,10}$/;

if (!idRegex.test(id)) {
  return res.send("아이디는 한글/영어만, 최대 10글자까지 가능합니다.");
}

  const data = fs.readFileSync('users.json', 'utf-8');
  const json = JSON.parse(data);

  const exists = json.users.find(u => u.id === id);
  if (exists) {
    return res.send("이미 존재하는 아이디");
  }

  const hashed = await bcrypt.hash(password, 10);

  json.users.push({
    id: id,
    password: hashed
  });

  fs.writeFileSync('users.json', JSON.stringify(json, null, 2));

  req.session.user = id;

  req.session.save(() => {
  res.redirect('/');
});
});

app.post('/login', async (req, res) => {
  console.log("LOGIN SESSION ID:", req.sessionID);
  const { id, password } = req.body;

  const data = fs.readFileSync('users.json', 'utf-8');
  const json = JSON.parse(data);

  const user = json.users.find(u => u.id === id);

  if (!user) {
    return res.send("아이디가 존재하지 않습니다.");
  }

  const ok = await bcrypt.compare(password, user.password);

  if (ok) {
    req.session.user = id;
    req.session.save(() => { 
      res.redirect('/');
    });
  } else {
    return res.send("비밀번호가 틀렸습니다.");
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

app.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ id: req.session.user });
  } else {
    res.json({ id: null });
  }
});

app.get('/chat', (req, res) => {
  const data = fs.readFileSync('chat.json', 'utf-8');
  const json = JSON.parse(data);
  res.json(json.messages);
});

app.post('/chat', (req, res) => {
  console.log("SESSION ID:", req.sessionID);
  console.log("SESSION DATA:", req.session);
  console.log("user:", req.session.user);
  if (!req.session.user) return res.send("로그인 필요");

  const data = fs.readFileSync('chat.json', 'utf-8');
  const json = JSON.parse(data);

  json.messages.push({
    id: req.session.user,
    text: req.body.text,
    time: new Date().toLocaleTimeString()
  });

  fs.writeFileSync('chat.json', JSON.stringify(json, null, 2));

  res.send("ok");
});

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.session.user) return res.send("로그인 필요");

  const imageUrl = '/uploads/' + req.file.filename;

  const data = fs.readFileSync('chat.json', 'utf-8');
  const json = JSON.parse(data);

  json.messages.push({
    id: req.session.user,
    image: imageUrl,
    time: new Date().toLocaleTimeString()
  });

  fs.writeFileSync('chat.json', JSON.stringify(json, null, 2));

  res.send("ok");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('listening on ' + PORT);
});
