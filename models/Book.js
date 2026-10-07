const mongoose = require('mongoose');
const { readConnection, writeConnection } = require('../config/db');

// Schema quản lý Sách
const bookSchema = new mongoose.Schema({
  bookCode: {
    type: String,
    required: [true, 'Mã sách không được để trống'],
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Tên sách không được để trống'],
    trim: true
  },
  author: {
    type: String,
    required: [true, 'Tác giả không được để trống'],
    trim: true
  },
  originalPrice: {
    type: Number,
    required: [true, 'Giá gốc không được để trống'],
    min: [0, 'Giá gốc phải lớn hơn hoặc bằng 0']
  },
  vatPercent: {
    type: Number,
    required: true
  },
  finalPrice: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Model cho luồng ĐỌC (gắn với readConnection)
const BookRead = readConnection.model('Book', bookSchema);

// Model cho luồng GHI (gắn với writeConnection)
const BookWrite = writeConnection.model('Book', bookSchema);

module.exports = {
  bookSchema,
  BookRead,
  BookWrite
};
