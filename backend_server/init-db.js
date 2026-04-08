/**
 * ===================================================================
 * Script khởi tạo Database PostgreSQL cho UNC BIDV
 * ===================================================================
 * Chạy lệnh: node init-db.js
 * 
 * Script này sẽ:
 * 1. Tạo các bảng: users, beneficiaries, transactions
 * 2. Tạo tài khoản admin mặc định
 * ===================================================================
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: '10.24.16.77',
  port: 5432,
  database: 'UNC_BIDV',
  user: 'postgres',
  password: 'longvdb',
});

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔄 Đang khởi tạo database UNC_BIDV...\n');

    // Tạo bảng users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(200),
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        branch VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Bảng users - OK');

    // Tạo bảng beneficiaries (danh bạ người hưởng)
    await client.query(`
      CREATE TABLE IF NOT EXISTS beneficiaries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        account VARCHAR(50) NOT NULL,
        bank VARCHAR(200),
        address VARCHAR(500),
        cccd VARCHAR(20),
        cccd_date VARCHAR(20),
        cccd_place VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, account, bank)
      );
    `);
    console.log('✅ Bảng beneficiaries - OK');

    // Tạo bảng transactions (lịch sử giao dịch)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        form_data JSONB NOT NULL,
        transaction_date VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Bảng transactions - OK');

    // Tạo indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_user ON beneficiaries(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at DESC);
    `);
    console.log('✅ Indexes - OK');

    // Tạo tài khoản admin mặc định
    const existing = await client.query("SELECT id FROM users WHERE username = 'admin'");
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('Admin@123456', 10);
      await client.query(
        `INSERT INTO users (username, password_hash, full_name, role, branch)
         VALUES ('admin', $1, 'Quản trị viên', 'admin', 'Cao Bằng')`,
        [hash]
      );
      console.log('✅ Tài khoản admin đã tạo (admin / Admin@123456)');
    } else {
      console.log('ℹ️  Tài khoản admin đã tồn tại');
    }

    console.log('\n🎉 Khởi tạo database thành công!');
    console.log('──────────────────────────────────');
    console.log('Database: UNC_BIDV');
    console.log('Server:   10.24.16.77:5432');
    console.log('Admin:    admin / Admin@123456');
    console.log('──────────────────────────────────');

  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

initDatabase();
