const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const filePath = path.join(__dirname, 'chat.json');

// 🔥 uploads 폴더 자동 생성
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

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

// 🔥 이미지 접근 가능하게
app.use('/uploads', express.static('uploads'));

// 🔥 multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, Date.now() + '.' + ext);
  }
});

const upload = multer({ storage });


// ================= 페이지 =================

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/join', (req, res) => {
  res.sendFile(__dirname + '/join.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});


// ================= 회원가입 =================

app.post('/register', async (req, res) => {
  const { id, password } = req.body;

  const idRegex = /^[a-zA-Z가-힣]{1,10}$/;
  if (!idRegex.test(id)) {
    return res.send("아이디는 한글/영어만, 최대 10글자");
  }

  const data = fs.readFileSync('users.json', 'utf-8');
  const json = JSON.parse(data);

  const exists = json.users.find(u => u.id === id);
  if (exists) return res.send("이미 존재하는 아이디");

  const hashed = await bcrypt.hash(password, 10);

  json.users.push({
    id,
    password: hashed
  });

  fs.writeFileSync('users.json', JSON.stringify(json, null, 2));

  req.session.user = id;
  req.session.save(() => {
    res.redirect('/');
  });
});


// ================= 로그인 =================

app.post('/login', async (req, res) => {
  const { id, password } = req.body;

  const data = fs.readFileSync('users.json', 'utf-8');
  const json = JSON.parse(data);

  const user = json.users.find(u => u.id === id);
  if (!user) return res.send("아이디 없음");

  const ok = await bcrypt.compare(password, user.password);

  if (ok) {
    req.session.user = id;
    req.session.save(() => {
      res.redirect('/');
    });
  } else {
    res.send("비밀번호 틀림");
  }
});


// ================= 로그아웃 =================

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});


// ================= 유저 확인 =================

app.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ id: req.session.user });
  } else {
    res.json({ id: null });
  }
});


// ================= 채팅 불러오기 =================

app.get('/chat', (req, res) => {
  const data = fs.readFileSync('chat.json', 'utf-8');
  const json = JSON.parse(data);
  res.json(json.messages);
});


// ================= 텍스트 채팅 =================

app.post('/chat', (req, res) => {
  if (!req.session.user) return res.send("로그인 필요");

  let json;

  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    json = JSON.parse(data);
  } catch (e) {
    json = { messages: [] };
  }

  if (!json.messages) json.messages = [];

  json.messages.push({
    id: req.session.user,
    text: req.body.text,
    time: new Date().toISOString() // 🔥 이것 추천
  });

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2));

  res.send("ok");
});

// ================= 이미지 업로드 =================

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


// ================= 서버 =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('listening on ' + PORT);
});