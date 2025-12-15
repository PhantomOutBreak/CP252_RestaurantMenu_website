const fs = require('fs').promises;
const path = require('path');

// ปรับเส้นทางไฟล์ JSON เป็นแบบสัมพัทธ์
const usersPath = path.join(__dirname, '..', 'controllers', 'users.json');

// Class User
class User {
    constructor(data) {
        this.id = data.id || Date.now(); // กำหนดค่าเริ่มต้นให้ ID
        this.email = data.email;
        this.username = data.username;
        this.password = data.password;
        this.favorites = data.favorites || [];
        this.todos = data.todos || []; // เพิ่มฟีเจอร์ To-Do
        this.dones = data.dones || []; // เพิ่มฟีเจอร์ Done
    }
}

// Class UserData
class UserData {
    constructor() {
        this.users = [];
        this.loadUsers(); // โหลดข้อมูลผู้ใช้ทันทีเมื่อสร้างอินสแตนซ์
    }

    // ฟังก์ชันโหลดข้อมูลผู้ใช้จากไฟล์
    async loadUsers() {
        console.time("loadUsers"); // เริ่มจับเวลา
        try {
            const data = await fs.readFile(usersPath, 'utf8');
            
            // ตรวจสอบว่า data มีค่าหรือไม่ก่อนที่จะใช้ trim
            if (!data || data.trim() === '') {
                throw new Error('ไฟล์ว่าง');
            }

            // แปลงข้อมูล JSON
            const parsedData = JSON.parse(data);
            if (!Array.isArray(parsedData.users)) {
                //throw new Error('รูปแบบของ users.json ไม่ถูกต้อง');
            }

            // แปลงข้อมูลผู้ใช้จาก JSON เป็น object ของ class User
            this.users = parsedData.users.map(userData => new User(userData));
        } catch (err) {
            if (err.code === 'ENOENT') {
                // หากไฟล์ไม่พบ ให้สร้างไฟล์ใหม่
                const initData = { users: [] };
                try {
                    await fs.writeFile(usersPath, JSON.stringify(initData, null, 2));
                    console.log('New file created:', usersPath);
                } catch (writeErr) {
                    //console.error('Error creating new file:', writeErr.message);
                }
                this.users = [];
                console.warn('Warning: ไฟล์ JSON ไม่มีอยู่ หรือไฟล์ว่างถูกพบ');
            } else if (err.message === 'ไฟล์ว่าง') {
                // แสดงข้อความเตือนกรณีไฟล์ว่าง
                console.warn('Warning: ไฟล์ JSON ว่างถูกพบ');
                this.users = [];
            } else {
                // แสดงข้อผิดพลาดหากเกิดปัญหากับการโหลดข้อมูล
                //console.error('Error loading users:', err.message);
                this.users = [];
            }
        }
        console.timeEnd("loadUsers"); // จบการจับเวลา
    }

    // ฟังก์ชันบันทึกข้อมูลผู้ใช้
    async saveUsers() {
        console.time("saveUsers"); // เริ่มจับเวลา
        const data = JSON.stringify({ users: this.users }, null, 2);
        try {
            await fs.writeFile(usersPath, data);
            console.log('Users saved successfully!');
        } catch (err) {
            //console.error('Error saving users:', err.message);
            throw err;
        }
        console.timeEnd("saveUsers"); // จบการจับเวลา
    }

    // เพิ่มผู้ใช้ใหม่
    async addNewUser(newUser) {
        console.time("addNewUser"); // เริ่มจับเวลา
        // ตรวจสอบชื่อผู้ใช้ซ้ำ
        const existingUser = this.users.find(u => 
            u.email.toLowerCase() === newUser.email.toLowerCase() || 
            u.username.toLowerCase() === newUser.username.toLowerCase()
        );
        if (existingUser) {
            console.timeEnd("addNewUser"); // จบการจับเวลา
            return { success: false, error: 'อีเมลหรือชื่อผู้ใช้ถูกใช้แล้ว' };
        }

        // กำหนด ID แบบอัตโนมัติ
        newUser.id = this.users.length + 1;
        this.users.push(new User(newUser)); // สร้าง User Object
        await this.saveUsers();
        console.timeEnd("addNewUser"); // จบการจับเวลา
        return { success: true, message: 'ผู้ใช้ถูกเพิ่มแล้ว' };
    }

    // จัดการรายการโปรด
    async toggleFavorite(userId, menuName) {
        console.time("toggleFavorite"); // เริ่มจับเวลา
        const user = this.users.find(u => u.id === userId);
        if (!user) {
            throw new Error('ผู้ใช้ไม่พบ');
        }

        const index = user.favorites.indexOf(menuName);
        if (index === -1) {
            user.favorites.push(menuName); // เพิ่มเมนูเป็นรายการโปรด
        } else {
            user.favorites.splice(index, 1); // ลบเมนูจากรายการโปรด
        }
        await this.saveUsers();
        console.timeEnd("toggleFavorite"); // จบการจับเวลา
        return user.favorites;
    }

    // จัดการ To-Do List
    async toggleTodo(userId, menuName) {
        console.time("toggleTodo"); // เริ่มจับเวลา
        const user = this.users.find(u => u.id === userId);
        if (!user) {
            throw new Error('ผู้ใช้ไม่พบ');
        }

        const index = user.todos.indexOf(menuName);
        if (index === -1) {
            user.todos.push(menuName); // เพิ่มเมนูเป็น To-Do
        } else {
            user.todos.splice(index, 1); // ลบเมนูจาก To-Do
        }
        await this.saveUsers();
        console.timeEnd("toggleTodo"); // จบการจับเวลา
        return user.todos;
    }

    // ย้ายเมนูจาก To-Do เป็น Done
    async markAsDone(userId, menuName) {
        console.time("markAsDone"); // เริ่มจับเวลา
        const user = this.users.find(u => u.id === userId);
        if (!user) {
            throw new Error('ผู้ใช้ไม่พบ');
        }

        // ตรวจสอบว่ามีเมนูนี้ใน To-Do
        const todoIndex = user.todos.indexOf(menuName);
        if (todoIndex === -1) {
            throw new Error('เมนูไม่พบใน To-Do List');
        }

        // ย้ายไปยัง Done และลบออกจาก To-Do
        user.dones.push(user.todos[todoIndex]);
        user.todos.splice(todoIndex, 1);
        await this.saveUsers();
        console.timeEnd("markAsDone"); // จบการจับเวลา
        return user.dones;
    }

    // ดึงข้อมูลผู้ใช้ตาม ID
    getUserById(userId) {
        return this.users.find(u => u.id === userId) || null;
    }

    // ตรวจสอบข้อมูลล็อกอิน
    async authenticateUser(email, password) {
        console.time("authenticateUser"); // เริ่มจับเวลา
        const user = this.users.find(u => u.email === email);
        if (!user) {
            console.timeEnd("authenticateUser"); // จบการจับเวลา
            return null;
        }

        // ตรวจสอบรหัสผ่าน (ใช้ bcrypt สำหรับระบบจริง)
        // ตัวอย่างการใช้ bcrypt:
        // const isMatch = await bcrypt.compare(password, user.password);
        // return isMatch ? user : null;

        // ใช้การตรวจสอบแบบง่ายสำหรับทดสอบ
        const result = password === user.password ? user : null;
        console.timeEnd("authenticateUser"); // จบการจับเวลา
        return result;
    }
}

module.exports = { User, UserData };
