# HƯỚNG DẪN CÀI ĐẶT SERVER UNC BIDV

## 📋 Yêu cầu hệ thống
- **Máy chủ**: Windows/Linux, IP: `10.24.16.77`
- **Node.js**: v18+ (khuyến nghị v20 LTS)
- **PostgreSQL**: v16+ hoặc v18

## 🔧 Bước 1: Cài đặt PostgreSQL

### Trên Windows:
1. Tải PostgreSQL từ https://www.postgresql.org/download/windows/
2. Cài đặt với password cho user `postgres`: **longvdb**
3. Mở pgAdmin hoặc psql, tạo database:
```sql
CREATE DATABASE "UNC_BIDV";
```

### Trên Linux:
```bash
sudo apt install postgresql-18
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'longvdb';"
sudo -u postgres psql -c 'CREATE DATABASE "UNC_BIDV";'
```

### Cấu hình PostgreSQL cho phép kết nối WAN:
Sửa file `postgresql.conf`:
```
listen_addresses = '*'
```

Sửa file `pg_hba.conf` - thêm các dòng:
```
# Cho phép các chi nhánh kết nối
host    UNC_BIDV    postgres    10.24.0.0/16    md5    # Cao Bằng
host    UNC_BIDV    postgres    10.42.0.0/16    md5    # Bắc Giang
host    UNC_BIDV    postgres    10.30.0.0/16    md5    # Lạng Sơn
host    UNC_BIDV    postgres    10.44.0.0/16    md5    # Bắc Ninh
```

Restart PostgreSQL sau khi sửa.

## 🔧 Bước 2: Cài đặt Node.js
1. Tải từ https://nodejs.org/ (LTS)
2. Kiểm tra: `node -v` và `npm -v`

### Cấu hình proxy (nếu cần tải packages):
```bash
npm config set proxy http://hn.proxy.vdb:8080
npm config set https-proxy http://hn.proxy.vdb:8080
```

## 🔧 Bước 3: Deploy ứng dụng

### 3.1 Copy thư mục `backend_server` lên máy chủ

### 3.2 Cài đặt dependencies:
```bash
cd backend_server
npm install
```

### 3.3 Khởi tạo database:
```bash
node init-db.js
```

### 3.4 Build Frontend và copy vào server:
Trên máy dev, build frontend:
```bash
# Tại thư mục gốc của project Lovable
npm run build
```
Copy toàn bộ nội dung thư mục `dist/` vào `backend_server/public/`

### 3.5 Khởi động server:
```bash
node server.js
```

## 🔧 Bước 4: Cấu hình Firewall
Mở port 3000 trên máy chủ:

### Windows:
```powershell
netsh advfirewall firewall add rule name="UNC BIDV" dir=in action=allow protocol=TCP localport=3000
```

### Linux:
```bash
sudo ufw allow 3000/tcp
```

## 🌐 Bước 5: Truy cập

Tất cả các chi nhánh truy cập qua trình duyệt:
```
http://10.24.16.77:3000
```

### Tài khoản mặc định:
- **Username**: admin
- **Password**: Admin@123456

## 🔄 Chạy tự động khi khởi động (Windows)

Tạo file `start-unc.bat`:
```bat
@echo off
cd C:\UNC-BIDV\backend_server
node server.js
```

Đặt vào Startup hoặc dùng Windows Task Scheduler.

## 🔄 Chạy tự động (Linux - systemd)

Tạo file `/etc/systemd/system/unc-bidv.service`:
```ini
[Unit]
Description=UNC BIDV Server
After=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/unc-bidv/backend_server
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable unc-bidv
sudo systemctl start unc-bidv
```

## ⚙️ Cấu hình Proxy

Nếu server cần truy cập internet qua proxy:
```bash
export HTTP_PROXY=http://hn.proxy.vdb:8080
export HTTPS_PROXY=http://hn.proxy.vdb:8080
```
