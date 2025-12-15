const fs = require('fs').promises;
const path = require('path');
const { User, UserData } = require('../models/task');

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('UserData', () => {
  let userData;

  beforeEach(() => {
    userData = new UserData();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'time').mockImplementation(() => {});
    jest.spyOn(console, 'timeEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    require('fs').promises.readFile.mockReset();
    require('fs').promises.writeFile.mockReset();
  });

  // Test 1: Constructor and loadUsers scenarios
  test('should handle constructor and loadUsers scenarios', async () => {
    const spy = jest.spyOn(UserData.prototype, 'loadUsers').mockImplementation(() => {});
    const instance = new UserData();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    const mockData = { users: [{ id: 1, email: 'test@test.com', username: 'testuser', password: 'password123' }] };
    require('fs').promises.readFile.mockResolvedValueOnce(JSON.stringify(mockData));
    await userData.loadUsers();
    expect(userData.users).toHaveLength(1);
    expect(userData.users[0].email).toBe('test@test.com');
    expect(console.time).toHaveBeenCalledWith('loadUsers');
    expect(console.timeEnd).toHaveBeenCalledWith('loadUsers');

    require('fs').promises.readFile.mockResolvedValueOnce('');
    await userData.loadUsers();
    expect(userData.users).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith('Warning: ไฟล์ JSON ว่างถูกพบ');

    require('fs').promises.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
    require('fs').promises.writeFile.mockResolvedValueOnce();
    await userData.loadUsers();
    expect(require('fs').promises.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ users: [] }, null, 2)
    );
    expect(console.warn).toHaveBeenCalledWith('Warning: ไฟล์ JSON ไม่มีอยู่ หรือไฟล์ว่างถูกพบ');

    require('fs').promises.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
    require('fs').promises.writeFile.mockRejectedValueOnce(new Error('Write error'));
    await userData.loadUsers();
    expect(console.warn).toHaveBeenCalledWith('Warning: ไฟล์ JSON ไม่มีอยู่ หรือไฟล์ว่างถูกพบ');

    require('fs').promises.readFile.mockResolvedValueOnce(JSON.stringify({ users: {} }));
    await userData.loadUsers();
    expect(userData.users).toEqual([]);

    require('fs').promises.readFile.mockResolvedValueOnce('invalid json');
    await userData.loadUsers();
    expect(userData.users).toEqual([]);

    require('fs').promises.readFile.mockRejectedValueOnce(new Error('Other error'));
    await userData.loadUsers();
    expect(userData.users).toEqual([]);
  });

  // Test 2: Save users scenarios
  test('should handle saveUsers scenarios', async () => {
    userData.users = [new User({ id: 1, email: 'test@test.com', username: 'testuser', password: 'password123' })];
    
    require('fs').promises.writeFile.mockResolvedValueOnce();
    await userData.saveUsers();
    expect(require('fs').promises.writeFile).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Users saved successfully!');
    expect(console.time).toHaveBeenCalledWith('saveUsers');
    expect(console.timeEnd).toHaveBeenCalledWith('saveUsers');

    require('fs').promises.writeFile.mockRejectedValueOnce(new Error('Write error'));
    await expect(userData.saveUsers()).rejects.toThrow('Write error');
  });

  // Test 3: Add new user scenarios
  test('should handle addNewUser scenarios', async () => {
    const newUser = { email: 'new@test.com', username: 'newuser', password: 'password123' };
    require('fs').promises.writeFile.mockResolvedValueOnce();
    let result = await userData.addNewUser(newUser);
    expect(result.success).toBe(true);
    expect(userData.users).toHaveLength(1);
    expect(userData.users[0].email).toBe('new@test.com');

    const newUser2 = { email: 'unique@test.com', username: 'uniqueuser', password: 'password123' };
    require('fs').promises.writeFile.mockResolvedValueOnce();
    result = await userData.addNewUser(newUser2);
    expect(result.success).toBe(true);
    expect(userData.users).toHaveLength(2);
    expect(userData.users[1].email).toBe('unique@test.com');

    const duplicateUser = { email: 'NEW@test.com', username: 'UNIQUEUSER', password: '123' };
    result = await userData.addNewUser(duplicateUser);
    expect(result.success).toBe(false);
    expect(result.error).toBe('อีเมลหรือชื่อผู้ใช้ถูกใช้แล้ว');

    const newUser3 = { email: 'fail@test.com', username: 'failuser', password: '123' };
    require('fs').promises.writeFile.mockRejectedValueOnce(new Error('Write error'));
    await expect(userData.addNewUser(newUser3)).rejects.toThrow('Write error');
  });

  // Test 4: Toggle favorite and todo, and mark as done
  test('should handle toggleFavorite, toggleTodo, and markAsDone scenarios', async () => {
    const user = new User({ id: 1, email: 'a@test.com', username: 'a', password: '123', favorites: [], todos: [], dones: [] });
    userData.users.push(user);

    require('fs').promises.writeFile.mockResolvedValueOnce();
    let favResult = await userData.toggleFavorite(1, 'Pizza');
    expect(favResult).toContain('Pizza');
    expect(user.favorites).toContain('Pizza');
    require('fs').promises.writeFile.mockResolvedValueOnce();
    favResult = await userData.toggleFavorite(1, 'Pizza');
    expect(favResult).not.toContain('Pizza');

    require('fs').promises.writeFile.mockResolvedValueOnce();
    let todoResult = await userData.toggleTodo(1, 'Task A');
    expect(todoResult).toContain('Task A');
    expect(user.todos).toContain('Task A');
    require('fs').promises.writeFile.mockResolvedValueOnce();
    todoResult = await userData.toggleTodo(1, 'Task A');
    expect(todoResult).not.toContain('Task A');

    user.todos.push('Clean'); // Ensure 'Clean' exists for markAsDone
    require('fs').promises.writeFile.mockResolvedValueOnce();
    const doneResult = await userData.markAsDone(1, 'Clean');
    expect(doneResult).toContain('Clean');
    expect(user.todos).not.toContain('Clean');
    expect(user.dones).toContain('Clean');

    await expect(userData.markAsDone(1, 'Not Found')).rejects.toThrow('เมนูไม่พบใน To-Do List');
  });

  // Test 5: Handle errors for toggleFavorite, toggleTodo, and markAsDone
  test('should handle errors for toggleFavorite, toggleTodo, and markAsDone', async () => {
    const user = new User({ id: 1, email: 'a@test.com', username: 'a', password: '123', favorites: [], todos: ['Task'], dones: [] });
    userData.users.push(user);

    await expect(userData.toggleFavorite(999, 'Pizza')).rejects.toThrow('ผู้ใช้ไม่พบ');
    await expect(userData.toggleTodo(999, 'Task A')).rejects.toThrow('ผู้ใช้ไม่พบ');
    await expect(userData.markAsDone(999, 'Task')).rejects.toThrow('ผู้ใช้ไม่พบ');

    // Test fs.writeFile error for each function with proper sequencing
    require('fs').promises.writeFile.mockResolvedValueOnce(); // Ensure initial call succeeds
    await userData.toggleFavorite(1, 'Pizza'); // Add to favorites first
    require('fs').promises.writeFile.mockRejectedValueOnce(new Error('Write error'));
    await expect(userData.toggleFavorite(1, 'Pizza')).rejects.toThrow('Write error'); // Test removal with error

    user.todos = ['Task']; // Reset todos to ensure 'Task' exists
    require('fs').promises.writeFile.mockRejectedValueOnce(new Error('Write error'));
    await expect(userData.toggleTodo(1, 'Task')).rejects.toThrow('Write error');

    user.todos = ['Task']; // Reset todos again
    require('fs').promises.writeFile.mockRejectedValueOnce(new Error('Write error'));
    await expect(userData.markAsDone(1, 'Task')).rejects.toThrow('Write error');
  });

  // Test 6: Get user by ID and authenticate user
  test('should handle getUserById and authenticateUser scenarios', async () => {
    const user = new User({ id: 1, email: 'auth@test.com', username: 'auth', password: '123' });
    userData.users.push(user);

    const found = userData.getUserById(1);
    expect(found).toBeDefined();
    expect(found.email).toBe('auth@test.com');

    expect(userData.getUserById(999)).toBeNull();

    const auth = await userData.authenticateUser('auth@test.com', '123');
    expect(auth).toBeDefined();
    expect(auth.email).toBe('auth@test.com');

    const authFailEmail = await userData.authenticateUser('wrong@test.com', '123');
    expect(authFailEmail).toBeNull();

    const authFailPassword = await userData.authenticateUser('auth@test.com', 'wrong');
    expect(authFailPassword).toBeNull();
  });

  // Test 7: User class scenarios
  test('should handle User class scenarios', () => {
    const mockNow = jest.spyOn(Date, 'now').mockReturnValue(99999);
    const user = new User({ email: 'x@test.com', username: 'x', password: '123' });
    expect(user.id).toBe(99999);
    expect(user.favorites).toEqual([]);
    expect(user.todos).toEqual([]);
    expect(user.dones).toEqual([]);
    mockNow.mockRestore();
  });
});