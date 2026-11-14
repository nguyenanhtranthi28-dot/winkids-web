// Cơ sở dữ liệu WinKids – chạy được 2 kiểu, không cần cài thư viện:
//  • Trên máy: file winkids.db (SQLite có sẵn trong Node.js)
//  • Trên Vercel: Turso (SQLite trên đám mây) – khi có biến môi trường TURSO_DATABASE_URL và TURSO_AUTH_TOKEN
// Cấu trúc bảng giống hệt file WinKid_Database.sql (SQL Server) dùng trong báo cáo.
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { AsyncLocalStorage } = require('node:async_hooks');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

const SCHEMA = `
CREATE TABLE TaiKhoan (
  maTaiKhoan TEXT PRIMARY KEY, hoTen TEXT NOT NULL, soDienThoai TEXT NOT NULL UNIQUE,
  matKhau TEXT NOT NULL, ngayTao TEXT NOT NULL DEFAULT (date('now','+7 hours')),
  trangThai TEXT NOT NULL DEFAULT 'HoatDong' CHECK (trangThai IN ('HoatDong','NgungHoatDong')));
CREATE TABLE PhanQuyen (maPhanQuyen TEXT PRIMARY KEY, tenPhanQuyen TEXT NOT NULL, moTa TEXT);
CREATE TABLE TaiKhoan_PhanQuyen (
  maTaiKhoan TEXT NOT NULL REFERENCES TaiKhoan(maTaiKhoan),
  maPhanQuyen TEXT NOT NULL REFERENCES PhanQuyen(maPhanQuyen),
  PRIMARY KEY (maTaiKhoan, maPhanQuyen));
CREATE TABLE DanhMuc (maDanhMuc TEXT PRIMARY KEY, tenDanhMuc TEXT NOT NULL UNIQUE, moTa TEXT);
CREATE TABLE Kho (maKho TEXT PRIMARY KEY, tenKho TEXT NOT NULL UNIQUE);
CREATE TABLE NguyenLieu (
  maNguyenLieu TEXT PRIMARY KEY, tenNguyenLieu TEXT NOT NULL UNIQUE, donViTinh TEXT NOT NULL, moTa TEXT,
  soLuongTon INTEGER NOT NULL DEFAULT 0 CHECK (soLuongTon >= 0),
  mucToiThieu INTEGER NOT NULL DEFAULT 3, mucToiDa INTEGER NOT NULL DEFAULT 5,
  trangThai TEXT NOT NULL DEFAULT 'DangSuDung' CHECK (trangThai IN ('DangSuDung','NgungSuDung')),
  maDanhMuc TEXT NOT NULL REFERENCES DanhMuc(maDanhMuc), maKho TEXT NOT NULL REFERENCES Kho(maKho));
CREATE TABLE NhaCungCap (
  maNCC TEXT PRIMARY KEY, tenNCC TEXT NOT NULL UNIQUE, soDienThoai TEXT NOT NULL UNIQUE, diaChi TEXT,
  trangThai TEXT NOT NULL DEFAULT 'DangHopTac' CHECK (trangThai IN ('DangHopTac','NgungHopTac')));
CREATE TABLE DonDatHang (
  maDonHang TEXT PRIMARY KEY, ngayDat TEXT NOT NULL DEFAULT (datetime('now','+7 hours')),
  trangThai TEXT NOT NULL DEFAULT 'ChoDatHang' CHECK (trangThai IN ('ChoDatHang','DaDatHang','DaHoanTat')),
  ghiChu TEXT, maNCC TEXT NOT NULL REFERENCES NhaCungCap(maNCC), maNguoiLap TEXT NOT NULL REFERENCES TaiKhoan(maTaiKhoan));
CREATE TABLE ChiTietDonDatHang (
  maDonHang TEXT NOT NULL REFERENCES DonDatHang(maDonHang), maNguyenLieu TEXT NOT NULL REFERENCES NguyenLieu(maNguyenLieu),
  soLuongDat INTEGER NOT NULL CHECK (soLuongDat > 0), ghiChu TEXT, PRIMARY KEY (maDonHang, maNguyenLieu));
CREATE TABLE PhieuNhapKho (
  maPhieuNhap TEXT PRIMARY KEY, ngayNhap TEXT NOT NULL DEFAULT (datetime('now','+7 hours')), hinhAnhHoaDon TEXT,
  trangThai TEXT NOT NULL DEFAULT 'ChoXacNhan' CHECK (trangThai IN ('ChoXacNhan','ChoXuLy','DaXacNhan')),
  ngayDuyet TEXT, ghiChu TEXT, maDonHang TEXT REFERENCES DonDatHang(maDonHang),
  maNguoiLap TEXT NOT NULL REFERENCES TaiKhoan(maTaiKhoan), maNguoiDuyet TEXT REFERENCES TaiKhoan(maTaiKhoan));
CREATE TABLE ChiTietPhieuNhap (
  maPhieuNhap TEXT NOT NULL REFERENCES PhieuNhapKho(maPhieuNhap), maNguyenLieu TEXT NOT NULL REFERENCES NguyenLieu(maNguyenLieu),
  soLuongThucNhan INTEGER NOT NULL CHECK (soLuongThucNhan >= 0), soLuongHoaDon INTEGER, donViTinhHoaDon TEXT,
  tyLeQuyDoi REAL NOT NULL DEFAULT 1 CHECK (tyLeQuyDoi > 0), PRIMARY KEY (maPhieuNhap, maNguyenLieu));
CREATE TABLE LoHang (
  maLo TEXT PRIMARY KEY, soLo TEXT NOT NULL, ngaySanXuat TEXT NOT NULL, hanSuDung TEXT NOT NULL,
  soLuongNhap INTEGER NOT NULL CHECK (soLuongNhap > 0), soLuongCon INTEGER NOT NULL,
  maPhieuNhap TEXT NOT NULL, maNguyenLieu TEXT NOT NULL,
  CHECK (hanSuDung > ngaySanXuat), CHECK (soLuongCon BETWEEN 0 AND soLuongNhap),
  FOREIGN KEY (maPhieuNhap, maNguyenLieu) REFERENCES ChiTietPhieuNhap(maPhieuNhap, maNguyenLieu));
CREATE TABLE SaiLechHangNhap (
  maSaiLech TEXT PRIMARY KEY, soLuongSaiLech INTEGER NOT NULL CHECK (soLuongSaiLech > 0),
  lyDo TEXT NOT NULL CHECK (lyDo IN ('GiaoThieu','GiaoSaiMatHang','HuHong','CanHanHetHan')),
  ngayGhiNhan TEXT NOT NULL DEFAULT (datetime('now','+7 hours')), maPhieuNhap TEXT NOT NULL, maNguyenLieu TEXT NOT NULL,
  FOREIGN KEY (maPhieuNhap, maNguyenLieu) REFERENCES ChiTietPhieuNhap(maPhieuNhap, maNguyenLieu));
CREATE TABLE AnhMinhChung (maAnh TEXT PRIMARY KEY, duongDan TEXT NOT NULL, maSaiLech TEXT NOT NULL REFERENCES SaiLechHangNhap(maSaiLech));
CREATE TABLE PhieuXuatKho (
  maPhieuXuat TEXT PRIMARY KEY, ngayXuat TEXT NOT NULL DEFAULT (datetime('now','+7 hours')), lyDoXuat TEXT NOT NULL,
  trangThai TEXT NOT NULL DEFAULT 'ChoXacNhan' CHECK (trangThai IN ('ChoXacNhan','DaXacNhan','ChoBoSungHang')),
  ngayDuyet TEXT, ghiChu TEXT, maNguoiLap TEXT NOT NULL REFERENCES TaiKhoan(maTaiKhoan), maNguoiDuyet TEXT REFERENCES TaiKhoan(maTaiKhoan));
CREATE TABLE ChiTietPhieuXuat (
  maPhieuXuat TEXT NOT NULL REFERENCES PhieuXuatKho(maPhieuXuat), maNguyenLieu TEXT NOT NULL REFERENCES NguyenLieu(maNguyenLieu),
  soLuongYeuCau INTEGER NOT NULL CHECK (soLuongYeuCau > 0), soLuongThucXuat INTEGER NOT NULL DEFAULT 0,
  trangThai TEXT NOT NULL DEFAULT 'Du' CHECK (trangThai IN ('Du','LayPhanConLai','ChoBoSung')),
  CHECK (soLuongThucXuat BETWEEN 0 AND soLuongYeuCau), PRIMARY KEY (maPhieuXuat, maNguyenLieu));
CREATE TABLE CanhBaoTonKho (
  maCanhBao TEXT PRIMARY KEY, thoiGianCanhBao TEXT NOT NULL DEFAULT (datetime('now','+7 hours')),
  soLuongHienTai INTEGER NOT NULL, noiDung TEXT NOT NULL,
  trangThai TEXT NOT NULL DEFAULT 'ChoQuanLyXem' CHECK (trangThai IN ('ChoQuanLyXem','DaXem')),
  maNguyenLieu TEXT NOT NULL REFERENCES NguyenLieu(maNguyenLieu));
CREATE TABLE NhatKyHeThong (
  maNhatKy TEXT PRIMARY KEY, thoiGian TEXT NOT NULL DEFAULT (datetime('now','+7 hours')),
  hanhDong TEXT NOT NULL, bangDuLieu TEXT NOT NULL, banGhiId TEXT NOT NULL, noiDungChiTiet TEXT NOT NULL,
  maTaiKhoan TEXT NOT NULL REFERENCES TaiKhoan(maTaiKhoan));
`;

// Dữ liệu mẫu (trả về danh sách câu lệnh để chạy một lần trong giao dịch)
function seedStatements() {
  const pw = hashPassword('123456'), s = [];
  const add = (sql, rows) => rows.forEach(r => s.push([sql, r]));
  add('INSERT INTO PhanQuyen VALUES (?,?,?)', [
    ['QuanLy', 'Quản lý', 'Toàn quyền quản lý kho'],
    ['NhanVien', 'Nhân viên', 'Nhập kho, xuất kho, tồn kho']]);
  add('INSERT INTO TaiKhoan (maTaiKhoan,hoTen,soDienThoai,matKhau,ngayTao) VALUES (?,?,?,?,?)', [
    ['TK001', 'Bá Minh', '0905100001', pw, '2026-10-01'],
    ['TK002', 'Nguyễn Văn A', '0905100002', pw, '2026-10-01'],
    ['TK003', 'Trần Thị B', '0905100003', pw, '2026-10-15'],
    ['TK004', 'Lê Văn C', '0905100004', pw, '2026-11-03']]);
  add('INSERT INTO TaiKhoan_PhanQuyen VALUES (?,?)', [['TK001', 'QuanLy'], ['TK002', 'NhanVien'], ['TK003', 'NhanVien']]);
  add('INSERT INTO DanhMuc VALUES (?,?,NULL)', [['DM01', 'Sữa'], ['DM02', 'Mứt & Syrup'], ['DM03', 'Đường'], ['DM04', 'Bột'], ['DM05', 'Topping']]);
  add('INSERT INTO Kho VALUES (?,?)', [['K01', 'Kho lạnh'], ['K02', 'Kho khô']]);
  const nl = [
    ['NL-001', 'Sữa tươi không đường', 'hộp', 'Sữa tươi dùng pha chế đồ uống', 'DM01', 'K01', 120],
    ['NL-002', 'Mứt dâu tây', 'kg', 'Mứt dùng pha chế trà trái cây', 'DM02', 'K01', 80],
    ['NL-003', 'Đường cát trắng', 'kg', 'Đường dùng pha chế và nấu syrup', 'DM03', 'K02', 150],
    ['NL-004', 'Bột mì số 8', 'kg', 'Bột dùng làm bánh', 'DM04', 'K02', 120],
    ['NL-005', 'Syrup đào', 'chai', 'Siro đào dùng pha chế trà trái cây', 'DM02', 'K02', 24],
    ['NL-006', 'Sữa đặc có đường', 'hộp', 'Sữa đặc dùng pha chế cà phê, trà sữa', 'DM01', 'K02', 36],
    ['NL-007', 'Sữa tươi có đường', 'hộp', 'Sữa tươi có đường dùng pha chế', 'DM01', 'K01', 45],
    ['NL-008', 'Bột mì đa dụng', 'kg', 'Bột mì dùng làm bánh', 'DM04', 'K02', 45],
    ['NL-009', 'Bột cacao', 'kg', 'Bột cacao pha chế', 'DM04', 'K02', 2],
    ['NL-010', 'Trân châu đen', 'gói', 'Topping trà sữa', 'DM05', 'K02', 6]];
  add('INSERT INTO NguyenLieu (maNguyenLieu,tenNguyenLieu,donViTinh,moTa,maDanhMuc,maKho) VALUES (?,?,?,?,?,?)', nl.map(r => r.slice(0, 6)));
  add('INSERT INTO NhaCungCap (maNCC,tenNCC,soDienThoai,diaChi) VALUES (?,?,?,?)', [
    ['NCC001', 'Nhân Em', '0905111222', 'Hải Châu, Đà Nẵng'],
    ['NCC002', 'Nhật Minh', '0905333444', 'Thanh Khê, Đà Nẵng'],
    ['NCC003', 'Minh Phát', '0935555666', 'Liên Chiểu, Đà Nẵng']]);
  add('INSERT INTO DonDatHang (maDonHang,ngayDat,trangThai,maNCC,maNguoiLap) VALUES (?,?,?,?,?)', [
    ['DH-0011', '2026-10-18 09:00', 'DaHoanTat', 'NCC002', 'TK001'],
    ['DH-0012', '2026-11-01 09:00', 'DaDatHang', 'NCC001', 'TK001'],
    ['DH-0013', '2026-10-28 09:00', 'DaDatHang', 'NCC002', 'TK001'],
    ['DH-0014', '2026-11-03 09:00', 'DaDatHang', 'NCC002', 'TK001'],
    ['DH-0015', '2026-11-06 09:00', 'ChoDatHang', 'NCC001', 'TK001']]);
  add('INSERT INTO ChiTietDonDatHang VALUES (?,?,?,NULL)', [
    ...nl.map(r => ['DH-0011', r[0], r[6]]),
    ['DH-0012', 'NL-001', 48], ['DH-0012', 'NL-009', 5], ['DH-0012', 'NL-010', 6],
    ['DH-0013', 'NL-002', 4], ['DH-0014', 'NL-003', 2],
    ['DH-0015', 'NL-006', 3], ['DH-0015', 'NL-002', 4], ['DH-0015', 'NL-009', 3]]);
  // Phiếu nhập đầu kỳ (đã xác nhận) tạo lô cho toàn bộ tồn hiện có
  s.push(["INSERT INTO PhieuNhapKho (maPhieuNhap,ngayNhap,trangThai,ngayDuyet,maDonHang,maNguoiLap,maNguoiDuyet) VALUES ('PN-0028','2026-10-20 08:00','DaXacNhan','2026-10-20 17:00','DH-0011','TK002','TK001')", []]);
  nl.forEach((r, i) => {
    s.push(["INSERT INTO ChiTietPhieuNhap VALUES ('PN-0028',?,?,?,?,1)", [r[0], r[6], r[6], r[2]]]);
    s.push(["INSERT INTO LoHang VALUES (?,?,?,?,?,?,'PN-0028',?)", ['LO-' + String(i + 1).padStart(4, '0'), 'L23' + String(i + 1).padStart(2, '0'), '2026-09-15', i === 4 ? '2026-11-25' : '2027-06-30', r[6], r[6], r[0]]]);
  });
  s.push(['UPDATE NguyenLieu SET soLuongTon = (SELECT IFNULL(SUM(soLuongCon),0) FROM LoHang WHERE LoHang.maNguyenLieu = NguyenLieu.maNguyenLieu)', []]);
  // Phiếu nhập chờ quản lý kiểm tra (UC 6.1)
  s.push(["INSERT INTO PhieuNhapKho (maPhieuNhap,ngayNhap,trangThai,maDonHang,maNguoiLap) VALUES ('PN-0029','2026-10-29 10:00','ChoXacNhan','DH-0013','TK002')", []]);
  s.push(["INSERT INTO ChiTietPhieuNhap VALUES ('PN-0029','NL-002',4,4,'kg',1)", []]);
  s.push(["INSERT INTO LoHang VALUES ('LO-0011','L2290','2026-10-01','2027-04-01',4,0,'PN-0029','NL-002')", []]);
  // Phiếu xuất đã xác nhận + chờ xác nhận (UC 4, UC 6.2)
  add('INSERT INTO PhieuXuatKho (maPhieuXuat,ngayXuat,lyDoXuat,trangThai,ngayDuyet,maNguoiLap,maNguoiDuyet) VALUES (?,?,?,?,?,?,?)', [
    ['PX-0009', '2026-11-01 18:00', 'Ca bán hàng', 'DaXacNhan', '2026-11-01 19:00', 'TK002', 'TK001'],
    ['PX-0010', '2026-11-02 18:00', 'Ca bán hàng', 'ChoXacNhan', null, 'TK003', null]]);
  add('INSERT INTO ChiTietPhieuXuat VALUES (?,?,?,?,?)', [
    ['PX-0009', 'NL-003', 2, 2, 'Du'], ['PX-0010', 'NL-001', 10, 10, 'Du'], ['PX-0010', 'NL-005', 2, 2, 'Du']]);
  s.push(["INSERT INTO CanhBaoTonKho (maCanhBao,thoiGianCanhBao,soLuongHienTai,noiDung,maNguyenLieu) VALUES ('CB-0001','2026-11-05 08:00',2,'Cảnh báo có nguyên liệu sắp hết: Bột cacao','NL-009')", []]);
  s.push(["INSERT INTO NhatKyHeThong VALUES ('NK-0001','2026-11-03 10:05','Sua','TaiKhoan_PhanQuyen','TK003','Gán quyền Nhân viên cho Trần Thị B','TK001')", []]);
  return s;
}
const schemaStatements = () => SCHEMA.split(/;\s*\n/).map(x => x.trim()).filter(Boolean).map(sql => [sql, []]);

/* ---------- Kiểu 1: file winkids.db trên máy ---------- */
function localBackend(file) {
  const { DatabaseSync } = require('node:sqlite');
  const fresh = !fs.existsSync(file);
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  const exec1 = (sql, args) => {
    const st = db.prepare(sql);
    if (/^\s*(select|with|pragma)/i.test(sql)) return st.all(...args).map(r => ({ ...r }));
    st.run(...args); return [];
  };
  const runMany = list => { db.exec('BEGIN'); try { list.forEach(([q, a]) => exec1(q, a)); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };
  if (fresh) { runMany([...schemaStatements(), ...seedStatements()]); console.log('Đã tạo cơ sở dữ liệu mới: winkids.db'); }
  return {
    kind: 'local',
    async query(sql, args) { return exec1(sql, args); },
    async begin() { db.exec('BEGIN'); return { query: async (q, a) => exec1(q, a), commit: async () => db.exec('COMMIT'), rollback: async () => db.exec('ROLLBACK') }; },
    async init() { }
  };
}

/* ---------- Kiểu 2: Turso (SQLite trên đám mây) qua HTTP ---------- */
function tursoBackend(url, token) {
  const base0 = url.trim().replace(/^(libsql|turso|wss?):\/\//, 'https://').replace(/\/+$/, '');
  const enc = v => v === null || v === undefined ? { type: 'null' }
    : typeof v === 'boolean' ? { type: 'integer', value: v ? '1' : '0' }
    : typeof v === 'number' ? (Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v })
    : { type: 'text', value: String(v) };
  const dec = c => c.type === 'null' ? null : c.type === 'integer' ? Number(c.value) : c.type === 'float' ? Number(c.value)
    : c.type === 'blob' ? Buffer.from(c.base64 || '', 'base64') : c.value;
  const toRows = r => r.rows.map(row => Object.fromEntries(r.cols.map((c, i) => [c.name, dec(row[i])])));
  async function pipeline(stream, requests) {
    const resp = await fetch((stream.base || base0) + '/v2/pipeline', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ baton: stream.baton || null, requests })
    });
    if (!resp.ok) throw new Error(`Turso HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    const j = await resp.json();
    stream.baton = j.baton || null; if (j.base_url) stream.base = j.base_url.replace(/\/+$/, '');
    return j.results;
  }
  const check = r => { if (r.type === 'error') { const e = new Error(r.error && r.error.message || 'Lỗi cơ sở dữ liệu'); e.code = r.error && r.error.code; throw e; } return r.response; };
  const stmt = (sql, args) => ({ type: 'execute', stmt: { sql, args: (args || []).map(enc) } });
  return {
    kind: 'turso',
    async query(sql, args) {
      const [r] = await pipeline({}, [stmt(sql, args), { type: 'close' }]);
      return toRows(check(r).result);
    },
    async begin() {
      const s = {}; check((await pipeline(s, [stmt('BEGIN IMMEDIATE')]))[0]); // giữ quyền ghi ngay từ đầu
      let done = false;
      const end = async sql => { if (done) return; done = true; try { check((await pipeline(s, [stmt(sql), { type: 'close' }]))[0]); } catch (e) { if (sql === 'COMMIT') throw e; } };
      return { query: async (q, a) => toRows(check((await pipeline(s, [stmt(q, a)]))[0]).result), commit: () => end('COMMIT'), rollback: () => end('ROLLBACK') };
    },
    // Lần chạy đầu: tự tạo bảng và dữ liệu mẫu (chỉ khi database còn trống)
    async init() {
      const [r] = await pipeline({}, [stmt("SELECT name FROM sqlite_master WHERE type='table' AND name='TaiKhoan'"), { type: 'close' }]);
      if (toRows(check(r).result).length) return;
      const s = {}; check((await pipeline(s, [stmt('BEGIN')]))[0]);
      const res = await pipeline(s, [...schemaStatements(), ...seedStatements()].map(([q, a]) => stmt(q, a)));
      const bad = res.find(x => x.type === 'error');
      if (bad) { await pipeline(s, [stmt('ROLLBACK'), { type: 'close' }]).catch(() => { }); if (!/already exists/i.test(bad.error.message)) throw new Error('Khởi tạo dữ liệu thất bại: ' + bad.error.message); return; }
      check((await pipeline(s, [stmt('COMMIT'), { type: 'close' }]))[0]);
      console.log('Đã tạo bảng và dữ liệu mẫu trên Turso');
    }
  };
}

/* ---------- Lớp dùng chung cho máy chủ ---------- */
function openDb() {
  const url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN;
  if (!url && process.env.VERCEL) { // chạy trên Vercel mà chưa khai báo Turso
    const err = async () => { throw new Error('Chưa khai báo TURSO_DATABASE_URL và TURSO_AUTH_TOKEN trong Vercel (Settings › Environment Variables).'); };
    return { kind: 'turso', init: err, all: err, get: err, run: err, tx: err };
  }
  if (url && !token) console.warn('Thiếu TURSO_AUTH_TOKEN');
  const be = url ? tursoBackend(url, token || '') : localBackend(path.join(__dirname, 'winkids.db'));
  const als = new AsyncLocalStorage();
  let lock = Promise.resolve();
  // Trên máy chỉ có 1 kết nối: xếp hàng các thao tác để giao dịch của người này không lẫn với người khác
  const queued = fn => { if (be.kind !== 'local') return fn(); const p = lock.then(fn, fn); lock = p.catch(() => { }); return p; };
  const q = (sql, args) => { const t = als.getStore(); return t ? t.query(sql, args) : queued(() => be.query(sql, args)); };
  let ready = null;
  return {
    kind: be.kind,
    init: () => ready || (ready = be.init().catch(e => { ready = null; throw e; })),
    all: (sql, ...a) => q(sql, a),
    get: async (sql, ...a) => (await q(sql, a))[0] || null,
    run: async (sql, ...a) => { await q(sql, a); },
    // Giao dịch: mọi lệnh bên trong fn cùng thành công hoặc cùng hủy
    tx: fn => als.getStore() ? fn() : queued(async () => {
      // Nhiều người lưu cùng lúc: nếu cơ sở dữ liệu đang bận thì chờ một chút rồi thử lại
      for (let lan = 0; ; lan++) {
        let t;
        try { t = await be.begin(); }
        catch (e) { if (lan < 10 && /busy|locked/i.test(e.message)) { await new Promise(r => setTimeout(r, 40 * 2 ** Math.min(lan, 5) * (0.5 + Math.random()))); continue; } throw e; }
        try { const r = await als.run(t, fn); await t.commit(); return r; } catch (e) { await t.rollback(); throw e; }
      }
    })
  };
}

module.exports = { openDb, hashPassword, checkPassword };
