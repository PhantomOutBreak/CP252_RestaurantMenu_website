// ─────────────────────────────────────────────────────────────
// 📦 Import Module
// ─────────────────────────────────────────────────────────────
const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs/promises');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const usersPath = path.join(__dirname, 'controllers', 'users.json');

// ─────────────────────────────────────────────────────────────
// ⚙️ Middleware
// ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict'
    }
}));

// ─────────────────────────────────────────────────────────────
// 📥 Utility: โหลดผู้ใช้จากไฟล์
// ─────────────────────────────────────────────────────────────
async function loadUsers() {
    console.time('loadUsers');
    try {
        const data = await fs.readFile(usersPath, 'utf8');
        const parsedData = JSON.parse(data);
        if (!Array.isArray(parsedData.users)) throw new Error('Invalid users.json format');

        parsedData.users.forEach(user => {
            user.favorites = user.favorites || [];
            user.todos = user.todos || [];
            user.dones = user.dones || [];
        });

        console.timeEnd('loadUsers');
        return parsedData.users;
    } catch (err) {
        if (err.code === 'ENOENT') {
            const initData = { users: [] };
            await fs.writeFile(usersPath, JSON.stringify(initData, null, 2));
            console.timeEnd('loadUsers');
            return [];
        }
        console.error('Error loading users:', err);
        throw err; // Throw error เพื่อให้ route จัดการ
    }
}

// ─────────────────────────────────────────────────────────────
// 💾 Utility: บันทึกผู้ใช้ลงไฟล์
// ─────────────────────────────────────────────────────────────
async function saveUsers(users) {
    console.time('saveUsers');
    const data = JSON.stringify({ users }, null, 2);
    try {
        await fs.writeFile(usersPath, data);
        console.timeEnd('saveUsers');
    } catch (err) {
        console.error('Error saving users:', err);
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────
// 📄 Routes (หน้า UI)
// ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/homepage'));
app.get('/homepage', (req, res) => res.render('homepage', { session: req.session }));

app.get('/register', (req, res) => {
    res.render('register', {
        error: req.session.error,
        success: req.session.success
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        error: req.session.error,
        success: req.session.success
    });
});

app.get('/menu', async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        req.session.error = 'กรุณาเข้าสู่ระบบ';
        return res.redirect('/login');
    }

    try {
        const users = await loadUsers();
        const user = users.find(u => u.id === req.session.user.id);
        if (!user) {
            req.session.error = 'ผู้ใช้ไม่พบ';
            return res.redirect('/login');
        }

        req.session.user = user;
        res.render('menu', { user });
    } catch (err) {
        console.error('Error fetching user:', err);
        req.session.error = 'เกิดข้อผิดพลาด';
        res.redirect('/login');
    }
});

const menuRoutes = ['pad-krapow', 'green-curry', 'tom-yum', 'nam-prik-ong'];
menuRoutes.forEach(route => {
    app.get(`/${route}`, (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        res.render(route, { user: req.session.user });
    });
});

// ─────────────────────────────────────────────────────────────
// 🧑‍💻 Auth Routes
// ─────────────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
    console.time('registerTimer');
    const { email, username, password } = req.body;
    try {
        const users = await loadUsers();

        if (!email || !username || !password) {
            req.session.error = 'กรุณากรอกข้อมูลให้ครบ';
            console.timeEnd('registerTimer');
            return res.redirect('/register');
        }

        if (password.length < 6) {
            req.session.error = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
            console.timeEnd('registerTimer');
            return res.redirect('/register');
        }

        const existingUser = users.find(u =>
            u.email.toLowerCase() === email.toLowerCase() ||
            u.username.toLowerCase() === username.toLowerCase()
        );
        if (existingUser) {
            req.session.error = 'อีเมลหรือชื่อผู้ใช้ถูกใช้แล้ว';
            console.timeEnd('registerTimer');
            return res.redirect('/register');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: users.length + 1,
            email: email.trim().toLowerCase(),
            username: username.trim(),
            password: hashedPassword,
            favorites: [],
            todos: [],
            dones: [],
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        await saveUsers(users);
        delete req.session.success;
        console.timeEnd('registerTimer');
        res.redirect('/login');
    } catch (err) {
        console.error('Error registering:', err);
        console.timeEnd('registerTimer');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const users = await loadUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            req.session.error = 'อีเมลไม่ถูกต้อง';
            return res.redirect('/login');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.session.error = 'พาสเวิร์ดผิด';
            return res.redirect('/login');
        }

        req.session.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            favorites: user.favorites,
            todos: user.todos,
            dones: user.dones,
            createdAt: user.createdAt
        };
        delete req.session.error;
        res.redirect('/menu');
    } catch (err) {
        console.error('Error logging in:', err);
        req.session.error = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    console.time("logoutTime");
    req.session.destroy(err => {
        console.timeEnd("logoutTime");
        if (err) {
            console.error('Error destroying session:', err);
            return res.redirect('/login');
        }
        res.redirect('/homepage');
    });
});

// ─────────────────────────────────────────────────────────────
// 🧠 API Routes (Favorites / To-Do / Done)
// ─────────────────────────────────────────────────────────────
app.put('/api/favorites', async (req, res) => {
    console.time('updateFavorites');
    const { menu } = req.body;
    if (!req.session.user || !req.session.user.id) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    if (!menu || typeof menu !== 'string' || menu.trim() === '') return res.status(400).json({ error: 'เมนูไม่ถูกต้อง' });

    try {
        const users = await loadUsers();
        const user = users.find(u => u.id === req.session.user.id);
        if (!user) return res.status(404).json({ error: 'ผู้ใช้ไม่พบ' });

        const index = user.favorites.indexOf(menu);
        if (index !== -1) user.favorites.splice(index, 1);
        else user.favorites.push(menu);

        await saveUsers(users);
        req.session.user.favorites = user.favorites;
        res.status(200).json({ success: true, favorites: user.favorites });
    } catch (err) {
        console.error('Error updating favorites:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
    console.timeEnd('updateFavorites');
});

app.put('/api/todo', async (req, res) => {
    const { menu } = req.body;
    if (!req.session.user || !req.session.user.id) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    if (!menu || typeof menu !== 'string' || menu.trim() === '') return res.status(400).json({ error: 'เมนูไม่ถูกต้อง' });

    try {
        const users = await loadUsers();
        const user = users.find(u => u.id === req.session.user.id);
        if (!user) return res.status(404).json({ error: 'ผู้ใช้ไม่พบ' });

        const index = user.todos.indexOf(menu);
        if (index !== -1) user.todos.splice(index, 1);
        else user.todos.push(menu);

        await saveUsers(users);
        req.session.user.todos = user.todos;
        res.status(200).json({ success: true, todos: user.todos });
    } catch (err) {
        console.error('Error updating todo:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.delete('/api/todo/:menu', async (req, res) => {
    console.time('markAsDone');
    const menuName = req.params.menu;
    if (!req.session.user || !req.session.user.id) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });

    try {
        const users = await loadUsers();
        const user = users.find(u => u.id === req.session.user.id);
        if (!user) return res.status(404).json({ error: 'ผู้ใช้ไม่พบ' });

        const todoIndex = user.todos.indexOf(menuName);
        if (todoIndex === -1) return res.status(400).json({ error: 'เมนูไม่มีใน To-Do' });

        user.dones.push(user.todos[todoIndex]);
        user.todos.splice(todoIndex, 1);
        await saveUsers(users);

        req.session.user.todos = user.todos;
        req.session.user.dones = user.dones;
        res.status(200).json({ success: true, dones: user.dones });
    } catch (err) {
        console.error('Error marking as done:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
    console.timeEnd('markAsDone');
});

app.get('/api/favorites', (req, res) => {
    if (!req.session.user || !req.session.user.id) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    res.status(200).json({ favorites: req.session.user.favorites });
});

app.get('/api/todo', (req, res) => {
    if (!req.session.user || !req.session.user.id) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    res.status(200).json({ todos: req.session.user.todos });
});

app.get('/api/done', (req, res) => {
    if (!req.session.user || !req.session.user.id) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    res.status(200).json({ dones: req.session.user.dones });
});

// ─────────────────────────────────────────────────────────────
// ⚠️ Error Handlers
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    if (req.session.error) {
        res.locals.error = req.session.error;
        delete req.session.error;
    }
    if (req.session.success) {
        res.locals.success = req.session.success;
        delete req.session.success;
    }
    next();
});

app.use((req, res) => {
    res.status(404).render('404', { url: req.url });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).render('500', { error: err.message });
});

// ─────────────────────────────────────────────────────────────
// 🚀 Start Server
// ─────────────────────────────────────────────────────────────
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running: http://localhost:${PORT}`);
    });
}

module.exports = app;