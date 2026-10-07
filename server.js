require('dotenv').config();
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const { BookRead, BookWrite } = require('./models/Book');

const app = express();
const PORT = process.env.PORT || 3000;

// Các thông số cá nhân hóa theo MSSV
const MSSV = process.env.MSSV || '23IT166';
const HOTEN = process.env.HOTEN || 'Trần Châu Minh';

// 1. Tiền tố mã sản phẩm: 3 số cuối MSSV
const prefix = MSSV.slice(-3); // Ví dụ: 23IT166 -> '166'

// 2. Thuế suất VAT: (Chữ số cuối MSSV + 4)%
const lastDigit = parseInt(MSSV.slice(-1), 10); // Ví dụ: 23IT166 -> 6
const vatPercent = lastDigit + 4; // 6 + 4 = 10%

// Cấu hình View Engine Handlebars
app.engine('handlebars', engine({
  helpers: {
    formatNumber: (val) => new Intl.NumberFormat('vi-VN').format(val || 0),
    formatDate: (val) => val ? new Date(val).toLocaleString('vi-VN') : ''
  }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Biến thông báo tạm thời cho luồng Database
let flashMessage = null;

// Route GET: Trang chủ hiển thị danh sách sách (Sử dụng luồng ĐỌC)
app.get('/', async (req, res) => {
  try {
    // Đa luồng: Sử dụng BookRead (kết nối chỉ đọc Least Privilege)
    const books = await BookRead.find().sort({ createdAt: -1 }).lean();

    const currentMsg = flashMessage;
    flashMessage = null;

    res.render('index', {
      books,
      mssv: MSSV,
      hoten: HOTEN,
      prefix,
      vatPercent,
      lastDigit,
      sessionId: 'Chưa kích hoạt (Nhánh Feature/Database)',
      sessionViews: 1,
      booksAddedInSession: 0,
      success: currentMsg?.type === 'success' ? currentMsg.text : null,
      error: currentMsg?.type === 'error' ? currentMsg.text : null
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
      sessionId: 'N/A',
      sessionViews: 0,
      booksAddedInSession: 0,
      error: `Không thể kết nối CSDL Đọc Cloud: ${err.message}`
    });
  }
});

// Route POST: Thêm sách mới (Sử dụng luồng GHI)
app.post('/books/add', async (req, res) => {
  try {
    const { bookCode, title, author, originalPrice } = req.body;

    // 1. Kiểm tra bộ lọc dữ liệu: Tiền tố bắt buộc là 3 số cuối MSSV
    if (!bookCode || !bookCode.trim().startsWith(prefix)) {
      flashMessage = {
        type: 'error',
        text: `Từ chối xử lý! Mã sản phẩm bắt buộc phải có tiền tố là 3 số cuối MSSV (${prefix}). Ví dụ: ${prefix}-BK01`
      };
      return res.redirect('/');
    }

    const price = parseFloat(originalPrice);
    if (isNaN(price) || price < 0) {
      flashMessage = {
        type: 'error',
        text: 'Giá gốc không hợp lệ!'
      };
      return res.redirect('/');
    }

    // 2. Thuật toán tính thuế động: VAT = (Chữ số cuối MSSV + 4)%
    // Tự động tính giá sau thuế trước khi lưu xuống CSDL Cloud
    const finalPrice = Math.round(price * (1 + vatPercent / 100));

    // 3. Đa luồng: Sử dụng BookWrite (kết nối ghi)
    await BookWrite.create({
      bookCode: bookCode.trim(),
      title: title.trim(),
      author: author.trim(),
      originalPrice: price,
      vatPercent,
      finalPrice
    });

    flashMessage = {
      type: 'success',
      text: `Thêm sách "${title}" thành công qua Luồng Ghi Cloud! Giá sau thuế (+${vatPercent}%): ${new Intl.NumberFormat('vi-VN').format(finalPrice)} đ`
    };

    res.redirect('/');
  } catch (err) {
    console.error('[Error] Lỗi khi ghi sách vào Cloud:', err);
    let errMsg = err.message;
    if (err.code === 11000) {
      errMsg = 'Mã sách này đã tồn tại trong hệ thống CSDL!';
    }
    flashMessage = {
      type: 'error',
      text: `Lỗi ghi CSDL Cloud: ${errMsg}`
    };
    res.redirect('/');
  }
});

// Khởi động Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Server Cloud Bookstore đang chạy tại http://localhost:${PORT}`);
  console.log(`Sinh viên: ${HOTEN} | MSSV: ${MSSV}`);
  console.log(`Tiền tố bắt buộc: ${prefix} | Thuế suất VAT: ${vatPercent}%`);
  console.log(`====================================================`);
});
