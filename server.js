require('dotenv').config();
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.MongoStore || connectMongo.default || connectMongo;
const { BookRead, BookWrite } = require('./models/Book');

const app = express();
const PORT = process.env.PORT || 3000;

// Các thông số cá nhân hóa theo MSSV
const MSSV = process.env.MSSV || '23IT166';
const HOTEN = process.env.HOTEN || 'Trần Châu Minh';

// 1. Tiền tố mã sản phẩm: 3 số cuối MSSV
const prefix = MSSV.slice(-3);

// 2. Thuế suất VAT: (Chữ số cuối MSSV + 4)%
const lastDigit = parseInt(MSSV.slice(-1), 10);
const vatPercent = lastDigit + 4;

// Cấu hình View Engine Handlebars
app.engine('handlebars', engine({
  helpers: {
    formatNumber: (val) => new Intl.NumberFormat('vi-VN').format(val || 0),
    formatDate: (val) => val ? new Date(val).toLocaleString('vi-VN') : ''
  }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware phân tích dữ liệu body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ====================================================================
// KIẾN TRÚC STATELESS SESSION (Cloud MongoDB Atlas Centralized Session)
// ====================================================================
// Để phục vụ Auto-scaling trên Cloud, tuyệt đối không lưu Session trong RAM server.
// Cấu hình lưu trữ tập trung Session trực tiếp xuống Cloud MongoDB Atlas.
// Dùng MONGODB_WRITE_URI vì tài khoản Read không có thẩm quyền tạo/ghi session.
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_WRITE_URI || 'mongodb://localhost:27017/DB_' + MSSV,
  dbName: `DB_${MSSV}`,
  collectionName: 'sessions',
  ttl: 24 * 60 * 60,
  autoRemove: 'native'
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_dam_may_vku_cloud_2026',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Route GET: Trang chủ hiển thị danh sách sách (Truy vấn qua luồng ĐỌC)
app.get('/', async (req, res) => {
  try {
    // Stateless Session: Tăng biến đếm lượt truy cập trong phiên làm việc
    req.session.views = (req.session.views || 0) + 1;

    // Lấy thông báo từ Session (Stateless Flash Message)
    const flash = req.session.flashMessage;
    delete req.session.flashMessage;

    // Đa luồng kết nối: Sử dụng BookRead (Tài khoản chỉ có quyền Đọc - Least Privilege)
    const books = await BookRead.find().sort({ createdAt: -1 }).lean();

    res.render('index', {
      books,
      mssv: MSSV,
      hoten: HOTEN,
      prefix,
      vatPercent,
      lastDigit,
      sessionId: req.sessionID || 'Phiên chưa tạo',
      sessionViews: req.session.views || 1,
      booksAddedInSession: req.session.booksAddedInSession || 0,
      success: flash?.type === 'success' ? flash.text : null,
      error: flash?.type === 'error' ? flash.text : null
    });
  } catch (err) {
    console.error('[Error] Lỗi khi đọc danh sách sách từ Cloud:', err);
    res.render('index', {
      books: [],
      mssv: MSSV,
      hoten: HOTEN,
      prefix,
      vatPercent,
      lastDigit,
      sessionId: req.sessionID || 'N/A',
      sessionViews: req.session?.views || 1,
      booksAddedInSession: req.session?.booksAddedInSession || 0,
      error: `Không thể kết nối CSDL Đọc Cloud: ${err.message}`
    });
  }
});

// Route POST: Thêm sách mới (Truy vấn qua luồng GHI)
app.post('/books/add', async (req, res) => {
  try {
    const { bookCode, title, author, originalPrice } = req.body;

    // 1. Kiểm tra bộ lọc dữ liệu: Mã sản phẩm bắt buộc phải có tiền tố là 3 số cuối MSSV
    if (!bookCode || !bookCode.trim().startsWith(prefix)) {
      req.session.flashMessage = {
        type: 'error',
        text: `Từ chối xử lý! Mã sản phẩm bắt buộc phải có tiền tố là 3 số cuối MSSV (${prefix}). Ví dụ: ${prefix}-BK01`
      };
      return res.redirect('/');
    }

    const price = parseFloat(originalPrice);
    if (isNaN(price) || price < 0) {
      req.session.flashMessage = {
        type: 'error',
        text: 'Giá gốc không hợp lệ! Vui lòng nhập số tiền dương.'
      };
      return res.redirect('/');
    }

    // 2. Thuật toán cá nhân hóa: VAT = (Chữ số cuối MSSV + 4)%
    // Tự động tính giá sau thuế trước khi lưu xuống CSDL Cloud
    const finalPrice = Math.round(price * (1 + vatPercent / 100));

    // 3. Đa luồng: Điều hướng sang kết nối GHI (BookWrite)
    await BookWrite.create({
      bookCode: bookCode.trim(),
      title: title.trim(),
      author: author.trim(),
      originalPrice: price,
      vatPercent,
      finalPrice
    });

    // Cập nhật thống kê phiên làm việc (Stateless Session)
    req.session.booksAddedInSession = (req.session.booksAddedInSession || 0) + 1;
    req.session.flashMessage = {
      type: 'success',
      text: `Thêm sách "${title}" thành công qua Luồng Ghi Cloud! Giá sau thuế (+${vatPercent}%): ${new Intl.NumberFormat('vi-VN').format(finalPrice)} đ`
    };

    res.redirect('/');
  } catch (err) {
    console.error('[Error] Lỗi khi ghi sách vào Cloud:', err);
    let errMsg = err.message;
    if (err.code === 11000) {
      errMsg = `Mã sách "${req.body.bookCode}" đã tồn tại trong CSDL!`;
    }
    req.session.flashMessage = {
      type: 'error',
      text: `Lỗi ghi CSDL Cloud: ${errMsg}`
    };
    res.redirect('/');
  }
});

// Khởi động ứng dụng
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Server Cloud Bookstore đang chạy tại: http://localhost:${PORT}`);
  console.log(`Sinh viên: ${HOTEN} | MSSV: ${MSSV}`);
  console.log(`Tiền tố bắt buộc (3 số cuối): ${prefix}`);
  console.log(`Mức thuế VAT: ${vatPercent}% (Chữ số cuối + 4)`);
  console.log(`Kiến trúc: Stateless Session trên MongoDB Atlas`);
  console.log(`====================================================`);
});
