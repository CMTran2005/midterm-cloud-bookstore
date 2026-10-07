require('dotenv').config();
const mongoose = require('mongoose');

const MSSV = process.env.MSSV || '23IT166';
const DB_NAME = `DB_${MSSV}`;

async function testConnection(role, uri) {
  console.log(`\n--------------------------------------------`);
  console.log(`[TEST] Đang kiểm tra kết nối tài khoản [${role}]...`);
  console.log(`URI: ${uri ? uri.replace(/:([^:@]+)@/, ':****@') : 'CHƯA CẤU HÌNH'}`);
  
  if (!uri) {
    console.error(`❌ Chưa cấu hình URI cho [${role}] trong file .env!`);
    return false;
  }

  try {
    const conn = await mongoose.createConnection(uri, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 5000
    }).asPromise();
    
    console.log(`✅ Kết nối [${role}] THÀNH CÔNG tới Database "${DB_NAME}"!`);
    await conn.close();
    return true;
  } catch (err) {
    console.error(`❌ Kết nối [${role}] THẤT BẠI: ${err.message}`);
    if (err.message.includes('Authentication failed')) {
      console.log(`👉 Nguyên nhân: Sai mật khẩu hoặc tài khoản chưa được tạo trong MongoDB Atlas -> Database Access.`);
    }
    return false;
  }
}

async function run() {
  console.log(`============================================`);
  console.log(`KIỂM TRA KẾT NỐI MONGODB ATLAS (MSSV: ${MSSV})`);
  console.log(`============================================`);
  
  const readSuccess = await testConnection('READ', process.env.MONGODB_READ_URI);
  const writeSuccess = await testConnection('WRITE', process.env.MONGODB_WRITE_URI);

  console.log(`\n============================================`);
  if (readSuccess && writeSuccess) {
    console.log(`🎉 TẤT CẢ KẾT NỐI ĐỀU HOÀN TOÀN HỢP LỆ!`);
    console.log(`Bạn có thể khởi động server bằng lệnh: npm start`);
  } else {
    console.log(`⚠️ Vui lòng kiểm tra lại Username/Password trong file .env`);
    console.log(`và cấu hình User tương ứng trên MongoDB Atlas.`);
  }
  console.log(`============================================\n`);
  process.exit(0);
}

run();
