const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// ตั้งค่าระบบ
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'my-super-secret-key',
    resave: false,
    saveUninitialized: true
}));

// ฟังก์ชัน อ่าน/เขียน ข้อมูลจากไฟล์ JSON (แทน Database)
async function readData() {
    await fs.ensureFile(DATA_FILE);
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return content ? JSON.parse(content) : [];
}

async function writeData(data) {
    await fs.writeJson(DATA_FILE, data, { spaces: 2 });
}

// --- Middleware ตรวจสอบการ Login ---
const checkAuth = (req, res, next) => {
    if (req.session.userId) next();
    else res.redirect('/login');
};

// --- ROUTES ---

app.get('/', (req, res) => res.redirect('/editor'));

// หน้าสมัครสมาชิก
app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const users = await readData();
    if (users.find(u => u.email === email)) {
        return res.render('register', { error: 'อีเมลนี้ถูกใช้ไปแล้ว' });
    }
    users.push({ id: Date.now(), email, password, content: "" });
    await writeData(users);
    res.redirect('/login');
});

// หน้าเข้าสู่ระบบ
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const users = await readData();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        req.session.userId = user.id;
        res.redirect('/editor');
    } else {
        res.render('login', { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
});

// หน้าเขียนงาน (ดึงงานที่ค้างออกมาโชว์)
app.get('/editor', checkAuth, async (req, res) => {
    const users = await readData();
    const user = users.find(u => u.id === req.session.userId);
    res.render('editor', { user });
});

// API สำหรับบันทึกงานค้าง (Auto-save)
app.post('/api/save', checkAuth, async (req, res) => {
    const { content } = req.body;
    const users = await readData();
    const index = users.findIndex(u => u.id === req.session.userId);
    if (index !== -1) {
        users[index].content = content;
        await writeData(users);
        res.json({ success: true, time: new Date().toLocaleTimeString() });
    } else {
        res.status(404).json({ success: false });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
