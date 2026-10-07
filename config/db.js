const mongoose = require('mongoose');

const MSSV = process.env.MSSV || '23IT166';
const DB_NAME = `DB_${MSSV}`;

// Cấu hình kết nối
const connectionOptions = {
  dbName: DB_NAME,
  serverSelectionTimeoutMS: 5000,
};

// 1. Connection chỉ đọc (Read Only Connection)
// Áp dụng nguyên tắc Least Privilege: Dùng tài khoản chỉ có quyền Read
const readConnection = mongoose.createConnection(
  process.env.MONGODB_READ_URI || 'mongodb://localhost:27017/DB_' + MSSV,
  connectionOptions
);

readConnection.on('connected', () => {
  console.log(`[Database] [READ-CONNECTION] Đã kết nối thành công tới MongoDB Atlas (${DB_NAME})`);
});

readConnection.on('error', (err) => {
  console.error(`[Database] [READ-CONNECTION] Lỗi kết nối:`, err.message);
});

// 2. Connection ghi dữ liệu (Write Connection)
// Áp dụng nguyên tắc Least Privilege: Dùng tài khoản có quyền ReadWrite
const writeConnection = mongoose.createConnection(
  process.env.MONGODB_WRITE_URI || 'mongodb://localhost:27017/DB_' + MSSV,
  connectionOptions
);

writeConnection.on('connected', () => {
  console.log(`[Database] [WRITE-CONNECTION] Đã kết nối thành công tới MongoDB Atlas (${DB_NAME})`);
});

writeConnection.on('error', (err) => {
  console.error(`[Database] [WRITE-CONNECTION] Lỗi kết nối:`, err.message);
});

module.exports = {
  readConnection,
  writeConnection,
  DB_NAME
};
