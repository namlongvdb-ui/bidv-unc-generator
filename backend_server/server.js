/**
 * ===================================================================
 * UNC BIDV - Node.js Backend Server
 * ===================================================================
 * Server phục vụ cả API và Frontend trên cùng cổng 3000
 * Máy chủ: 10.24.16.77
 * Database: PostgreSQL 18 - UNC_BIDV
 *
 * Các máy trạm kết nối qua WAN:
 * - Cao Bằng: 10.24.x.x
 * - Bắc Giang: 10.42.x.x
 * - Lạng Sơn: 10.30.x.x
 * - Bắc Ninh: 10.44.x.x
 *
 * Proxy: hn.proxy.vdb:8080
 * ===================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ======================== CẤU HÌNH ========================

const CONFIG = {
  PORT: 3000,
  HOST: '0.0.0.0', // Lắng nghe trên tất cả interfaces để WAN truy cập được
  JWT_SECRET: 'bidv-unc-secret-key-change-in-production',
  JWT_EXPIRES_IN: '24h',
};

// Cấu hình kết nối PostgreSQL
const pool = new Pool({
  host: '10.24.16.77',
  port: 5432,
  database: 'UNC_BIDV',
  user: 'postgres',
  password: 'longvdb',
  max: 20,                   // Tối đa 20 kết nối đồng thời
  idleTimeoutMillis: 30000,  // Đóng kết nối idle sau 30s
  connectionTimeoutMillis: 5000, // Timeout kết nối 5s
});

const app = express();

// ======================== MIDDLEWARE ========================

// Cho phép tất cả các IP trong mạng WAN truy cập
app.use(cors({
  origin: [
    /^http:\/\/10\.24\.\d+\.\d+/,   // Cao Bằng
    /^http:\/\/10\.42\.\d+\.\d+/,   // Bắc Giang
    /^http:\/\/10\.30\.\d+\.\d+/,   // Lạng Sơn
    /^http:\/\/10\.44\.\d+\.\d+/,   // Bắc Ninh
    /^http:\/\/localhost/,
    /^http:\/\/127\.0\.0\.1/,
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Log request để debug
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  console.log(`[${new Date().toLocaleString('vi-VN')}] ${req.method} ${req.path} - IP: ${clientIP}`);
  next();
});

// ======================== AUTH MIDDLEWARE ========================

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
  }
}

// ======================== API ROUTES ========================

// --- Health check ---
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time');
    res.json({
      status: 'OK',
      server: '10.24.16.77',
      database: 'UNC_BIDV',
      time: result.rows[0].time,
      clientIP: req.ip,
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// --- Đăng nhập ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, branch: user.branch },
      CONFIG.JWT_SECRET,
      { expiresIn: CONFIG.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role, branch: user.branch },
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
  }
});

// --- Lấy thông tin user hiện tại ---
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, full_name, role, branch FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CRUD Người hưởng (Beneficiaries) ---
app.get('/api/beneficiaries', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM beneficiaries WHERE user_id = $1 ORDER BY name',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/beneficiaries', authMiddleware, async (req, res) => {
  const { name, account, bank, address, cccd, cccd_date, cccd_place } = req.body;
  try {
    // Kiểm tra trùng
    const existing = await pool.query(
      'SELECT id FROM beneficiaries WHERE user_id = $1 AND account = $2 AND bank = $3',
      [req.user.id, account, bank]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Người hưởng đã tồn tại' });
    }

    const result = await pool.query(
      `INSERT INTO beneficiaries (user_id, name, account, bank, address, cccd, cccd_date, cccd_place)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, name, account, bank, address, cccd, cccd_date, cccd_place]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/beneficiaries/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM beneficiaries WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CRUD Lịch sử giao dịch (Transactions) ---
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
  const { form_data } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, form_data, transaction_date)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, JSON.stringify(form_data), form_data.date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin: Quản lý users ---
app.get('/api/admin/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Không có quyền' });
  try {
    const result = await pool.query('SELECT id, username, full_name, role, branch, created_at FROM users ORDER BY created_at');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Không có quyền' });
  const { username, password, full_name, role, branch } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, branch)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, role, branch`,
      [username, hash, full_name, role || 'user', branch]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Không có quyền' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================== PHỤC VỤ FRONTEND ========================

// Phục vụ các file tĩnh từ thư mục build của React (sau khi chạy npm run build)
app.use(express.static(path.join(__dirname, 'public')));

// Mọi route không match API sẽ trả về index.html (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ======================== KHỞI ĐỘNG SERVER ========================

app.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       UNC BIDV - Server đã khởi động thành công     ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Server:   http://10.24.16.77:${CONFIG.PORT}               ║`);
  console.log('║  Database: UNC_BIDV @ 10.24.16.77:5432              ║');
  console.log('║  Proxy:    hn.proxy.vdb:8080                        ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Truy cập từ các chi nhánh:                         ║');
  console.log(`║  - Cao Bằng:  http://10.24.16.77:${CONFIG.PORT}            ║`);
  console.log(`║  - Bắc Giang: http://10.24.16.77:${CONFIG.PORT}            ║`);
  console.log(`║  - Lạng Sơn:  http://10.24.16.77:${CONFIG.PORT}            ║`);
  console.log(`║  - Bắc Ninh:  http://10.24.16.77:${CONFIG.PORT}            ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});

// Xử lý lỗi
process.on('uncaughtException', (err) => {
  console.error('[FATAL]', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED]', err);
});
