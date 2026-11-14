// Máy chủ web WinKids – chỉ dùng Node.js thuần, không cần cài thư viện
process.removeAllListeners('warning');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDb, hashPassword, checkPassword } = require('./db');

const PORT = process.env.PORT || 3000;
const db = openDb();
const { all, get, run, tx } = db;

// ---------- tiện ích ----------
// Giờ Việt Nam (UTC+7) – máy chủ Vercel chạy giờ quốc tế nên không dùng giờ máy
const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
const today = () => now().slice(0, 10);
class HttpError extends Error { constructor(status, msg, data) { super(msg); this.status = status; this.data = data; } }
const fail = (status, msg, data) => { throw new HttpError(status, msg, data); };

async function nextId(table, col, prefix, width = 4) {
  const r = await get(`SELECT ${col} AS id FROM ${table} WHERE ${col} LIKE ? ORDER BY ${col} DESC LIMIT 1`, prefix + '%');
  const n = r ? parseInt(r.id.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(width, '0');
}
async function log(user, hanhDong, bang, id, noiDung) {
  await run('INSERT INTO NhatKyHeThong VALUES (?,?,?,?,?,?,?)', 'NK-' + Date.now() + crypto.randomBytes(2).toString('hex'), now(), hanhDong, bang, id, noiDung, user.maTaiKhoan);
}
async function roleOf(ma) { const r = await get('SELECT maPhanQuyen FROM TaiKhoan_PhanQuyen WHERE maTaiKhoan=?', ma); return r ? r.maPhanQuyen : null; }
// Ảnh được lưu thẳng trong cơ sở dữ liệu (dạng chuỗi data:image/...) để không bị mất khi chạy trên Vercel
function saveImage(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) fail(400, 'Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG hoặc PNG.');
  if (m[2].length * 0.75 > 2.5 * 1024 * 1024) fail(400, 'Ảnh quá lớn, vui lòng chọn ảnh khác.');
  return dataUrl;
}
// Cảnh báo tự động khi tồn xuống dưới mức tối thiểu (UC 6.4)
async function capNhatTon(maNL, delta) {
  const nl = await get('SELECT * FROM NguyenLieu WHERE maNguyenLieu=?', maNL);
  const moi = nl.soLuongTon + delta;
  await run('UPDATE NguyenLieu SET soLuongTon=? WHERE maNguyenLieu=?', moi, maNL);
  if (moi < nl.mucToiThieu && nl.soLuongTon >= nl.mucToiThieu)
    await run('INSERT INTO CanhBaoTonKho (maCanhBao,thoiGianCanhBao,soLuongHienTai,noiDung,maNguyenLieu) VALUES (?,?,?,?,?)',
      await nextId('CanhBaoTonKho', 'maCanhBao', 'CB-'), now(), moi, 'Cảnh báo có nguyên liệu sắp hết: ' + nl.tenNguyenLieu, maNL);
}

// ---------- đăng nhập: phiên lưu trong cookie có chữ ký (không cần bộ nhớ máy chủ) ----------
const SECRET = process.env.SESSION_SECRET
  || (process.env.TURSO_AUTH_TOKEN ? crypto.createHash('sha256').update('winkids-session:' + process.env.TURSO_AUTH_TOKEN).digest('hex') : crypto.randomBytes(32).toString('hex'));
const PHIEN_NGAY = 7; // giữ đăng nhập 7 ngày
const ky = v => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const taoPhien = ma => { const v = `${ma}.${Date.now() + PHIEN_NGAY * 864e5}`; return `${v}.${ky(v)}`; };
function docPhien(t) {
  const p = String(t || '').split('.'); if (p.length !== 3) return null;
  const v = p[0] + '.' + p[1], sig = ky(v);
  if (sig.length !== p[2].length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(p[2]))) return null;
  return +p[1] > Date.now() ? p[0] : null;
}
const cookieOpts = req => `HttpOnly; Path=/; SameSite=Lax${(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : ''}`;

// ---------- định tuyến API ----------
const routes = [];
const api = (method, pattern, role, handler) => {
  const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, role, handler });
};

// UC 1 – Đăng nhập (tên đăng nhập là số điện thoại)
api('POST', '/api/login', null, async (req, body, res) => {
  const sdt = String(body.soDienThoai || '').replace(/\s/g, ''), mk = String(body.matKhau || '');
  if (!sdt || !mk) fail(400, 'Không được để trống!');
  const tk = await get('SELECT * FROM TaiKhoan WHERE soDienThoai=?', sdt);
  if (!tk || tk.trangThai !== 'HoatDong' || !checkPassword(mk, tk.matKhau)) fail(401, 'Đăng nhập không thành công!');
  if (!await roleOf(tk.maTaiKhoan)) fail(403, 'Tài khoản chưa được phân quyền.');
  res.setHeader('Set-Cookie', `sid=${taoPhien(tk.maTaiKhoan)}; Max-Age=${PHIEN_NGAY * 86400}; ${cookieOpts(req)}`);
  await log(tk, 'DangNhap', 'TaiKhoan', tk.maTaiKhoan, tk.hoTen + ' đăng nhập');
  return { ok: true };
});
api('POST', '/api/logout', 'any', async (req, b, res) => { res.setHeader('Set-Cookie', `sid=; Max-Age=0; ${cookieOpts(req)}`); return { ok: true }; });
api('POST', '/api/doimatkhau', 'any', async (req, b) => {
  const cu = String(b.matKhauCu || ''), moi = String(b.matKhauMoi || '');
  if (!cu || !moi) fail(400, 'Không được để trống!');
  if (moi.length < 6) fail(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
  if (!checkPassword(cu, req.user.matKhau)) fail(400, 'Mật khẩu hiện tại không đúng');
  await run('UPDATE TaiKhoan SET matKhau=? WHERE maTaiKhoan=?', hashPassword(moi), req.user.maTaiKhoan);
  await log(req.user, 'Sua', 'TaiKhoan', req.user.maTaiKhoan, req.user.hoTen + ' đổi mật khẩu'); return { ok: true };
});
api('GET', '/api/me', 'any', async (req) => {
  const u = req.user;
  const canhBao = u.role === 'QuanLy' ? (await get("SELECT COUNT(*) n FROM CanhBaoTonKho WHERE trangThai='ChoQuanLyXem'")).n : 0;
  return { maTaiKhoan: u.maTaiKhoan, hoTen: u.hoTen, soDienThoai: u.soDienThoai, role: u.role, canhBao };
});

// Tổng quan
api('GET', '/api/tongquan', 'any', async () => ({
  tongMatHang: (await get("SELECT COUNT(*) n FROM NguyenLieu WHERE trangThai='DangSuDung'")).n,
  donChoNhap: (await get("SELECT COUNT(*) n FROM DonDatHang WHERE trangThai='DaDatHang'")).n,
  phieuNhapChoXacNhan: (await get("SELECT COUNT(*) n FROM PhieuNhapKho WHERE trangThai IN ('ChoXacNhan','ChoXuLy')")).n,
  phieuXuatHomNay: (await get("SELECT COUNT(*) n FROM PhieuXuatKho WHERE date(ngayXuat)=?", today())).n,
  duoiMuc: (await get("SELECT COUNT(*) n FROM NguyenLieu WHERE soLuongTon < mucToiThieu AND trangThai='DangSuDung'")).n,
  phieuGanDay: await all(`SELECT * FROM (
      SELECT p.maPhieuNhap ma, 'Nhập kho' loai, p.ngayNhap ngay, t.hoTen nguoiLap, p.trangThai FROM PhieuNhapKho p JOIN TaiKhoan t ON t.maTaiKhoan=p.maNguoiLap
      UNION ALL SELECT p.maPhieuXuat, 'Xuất kho', p.ngayXuat, t.hoTen, p.trangThai FROM PhieuXuatKho p JOIN TaiKhoan t ON t.maTaiKhoan=p.maNguoiLap)
    ORDER BY ngay DESC LIMIT 6`)
}));

// UC 2 / UC 8 – Nguyên liệu (loại sản phẩm)
api('GET', '/api/danhmuc', 'any', async () => await all('SELECT * FROM DanhMuc ORDER BY tenDanhMuc'));
api('GET', '/api/kho', 'any', async () => await all('SELECT * FROM Kho ORDER BY maKho'));
api('GET', '/api/nguyenlieu', 'any', async (req) => {
  const q = req.query;
  let sql = `SELECT nl.*, dm.tenDanhMuc, k.tenKho, (nl.soLuongTon < nl.mucToiThieu) duoiMuc
             FROM NguyenLieu nl JOIN DanhMuc dm ON dm.maDanhMuc=nl.maDanhMuc JOIN Kho k ON k.maKho=nl.maKho WHERE nl.trangThai='DangSuDung'`;
  const p = [];
  if (q.q) { sql += ' AND (lower(nl.tenNguyenLieu) LIKE ? OR lower(nl.maNguyenLieu) LIKE ?)'; p.push('%' + q.q.toLowerCase() + '%', '%' + q.q.toLowerCase() + '%'); }
  if (q.dm) { sql += ' AND nl.maDanhMuc=?'; p.push(q.dm); }
  if (q.kho) { sql += ' AND nl.maKho=?'; p.push(q.kho); }
  return await all(sql + ' ORDER BY nl.maNguyenLieu', ...p);
});
async function kiemTraNL(b, ma) {
  for (const [k, t] of [['maNguyenLieu', 'Mã loại sản phẩm'], ['tenNguyenLieu', 'Tên loại sản phẩm'], ['donViTinh', 'Đơn vị tính']])
    if (!String(b[k] || '').trim()) fail(400, t + ' không được để trống!', { field: k });
  if (await get('SELECT 1 FROM NguyenLieu WHERE maNguyenLieu=? AND maNguyenLieu<>?', b.maNguyenLieu.trim(), ma || '')) fail(409, 'Mã loại sản phẩm đã tồn tại!', { field: 'maNguyenLieu' });
  if (await get('SELECT 1 FROM NguyenLieu WHERE lower(tenNguyenLieu)=lower(?) AND maNguyenLieu<>?', b.tenNguyenLieu.trim(), ma || '')) fail(409, 'Tên loại sản phẩm đã tồn tại!', { field: 'tenNguyenLieu' });
}
api('POST', '/api/nguyenlieu', 'QuanLy', async (req, b) => {
  await kiemTraNL(b);
  await run('INSERT INTO NguyenLieu (maNguyenLieu,tenNguyenLieu,donViTinh,moTa,maDanhMuc,maKho,mucToiThieu,mucToiDa) VALUES (?,?,?,?,?,?,?,?)',
    b.maNguyenLieu.trim(), b.tenNguyenLieu.trim(), b.donViTinh.trim(), b.moTa || null, b.maDanhMuc || 'DM01', b.maKho || 'K02', +b.mucToiThieu || 3, +b.mucToiDa || 5);
  await log(req.user, 'Them', 'NguyenLieu', b.maNguyenLieu, 'Thêm loại sản phẩm ' + b.tenNguyenLieu);
  return { ok: true };
});
api('PUT', '/api/nguyenlieu/:id', 'QuanLy', async (req, b, res, p) => {
  const cu = await get('SELECT * FROM NguyenLieu WHERE maNguyenLieu=?', p.id); if (!cu) fail(404, 'Không tìm thấy loại sản phẩm');
  b.maNguyenLieu = p.id; await kiemTraNL(b, p.id);
  await run('UPDATE NguyenLieu SET tenNguyenLieu=?,donViTinh=?,moTa=?,maDanhMuc=?,maKho=? WHERE maNguyenLieu=?',
    b.tenNguyenLieu.trim(), b.donViTinh.trim(), b.moTa || null, b.maDanhMuc || cu.maDanhMuc, b.maKho || cu.maKho, p.id);
  await log(req.user, 'Sua', 'NguyenLieu', p.id, `Sửa loại sản phẩm ${p.id}: ${cu.tenNguyenLieu} → ${b.tenNguyenLieu}`);
  return { ok: true };
});
api('DELETE', '/api/nguyenlieu/:id', 'QuanLy', async (req, b, res, p) => {
  const cu = await get('SELECT * FROM NguyenLieu WHERE maNguyenLieu=?', p.id); if (!cu) fail(404, 'Không tìm thấy loại sản phẩm, vui lòng kiểm tra lại!');
  const dung = await get('SELECT 1 FROM ChiTietPhieuNhap WHERE maNguyenLieu=? UNION SELECT 1 FROM ChiTietPhieuXuat WHERE maNguyenLieu=? UNION SELECT 1 FROM ChiTietDonDatHang WHERE maNguyenLieu=?', p.id, p.id, p.id);
  if (dung) await run("UPDATE NguyenLieu SET trangThai='NgungSuDung' WHERE maNguyenLieu=?", p.id); // đã có giao dịch: ngừng sử dụng
  else await run('DELETE FROM NguyenLieu WHERE maNguyenLieu=?', p.id);
  await log(req.user, 'Xoa', 'NguyenLieu', p.id, 'Xóa loại sản phẩm ' + cu.tenNguyenLieu);
  return { ok: true };
});

// UC 7.2 – 7.4 – Nhà cung cấp
api('GET', '/api/ncc', 'any', async (req) => {
  const q = (req.query.q || '').toLowerCase();
  return await all("SELECT * FROM NhaCungCap WHERE trangThai='DangHopTac' AND (lower(tenNCC) LIKE ? OR soDienThoai LIKE ?) ORDER BY maNCC", `%${q}%`, `%${q}%`);
});
async function kiemTraNCC(b, ma) {
  if (!String(b.tenNCC || '').trim() || !String(b.soDienThoai || '').trim()) fail(400, 'Vui lòng nhập đầy đủ thông tin');
  const sdt = b.soDienThoai.replace(/\s/g, '');
  if (!/^0\d{9}$/.test(sdt)) fail(400, 'Số điện thoại không hợp lệ', { field: 'soDienThoai' });
  const trung = await get('SELECT tenNCC FROM NhaCungCap WHERE (lower(tenNCC)=lower(?) OR soDienThoai=?) AND maNCC<>?', b.tenNCC.trim(), sdt, ma || '');
  if (trung) fail(409, 'Nhà cung cấp đã tồn tại', { trungVoi: trung.tenNCC });
  return sdt;
}
api('POST', '/api/ncc', 'QuanLy', async (req, b) => {
  const sdt = await kiemTraNCC(b); const ma = await nextId('NhaCungCap', 'maNCC', 'NCC', 3);
  await run('INSERT INTO NhaCungCap (maNCC,tenNCC,soDienThoai,diaChi) VALUES (?,?,?,?)', ma, b.tenNCC.trim(), sdt, b.diaChi || null);
  await log(req.user, 'Them', 'NhaCungCap', ma, 'Thêm nhà cung cấp ' + b.tenNCC); return { ok: true, maNCC: ma };
});
api('PUT', '/api/ncc/:id', 'QuanLy', async (req, b, res, p) => {
  const sdt = await kiemTraNCC(b, p.id);
  await run('UPDATE NhaCungCap SET tenNCC=?,soDienThoai=?,diaChi=? WHERE maNCC=?', b.tenNCC.trim(), sdt, b.diaChi || null, p.id);
  await log(req.user, 'Sua', 'NhaCungCap', p.id, 'Sửa thông tin nhà cung cấp ' + b.tenNCC); return { ok: true };
});
api('DELETE', '/api/ncc/:id', 'QuanLy', async (req, b, res, p) => {
  const ncc = await get('SELECT * FROM NhaCungCap WHERE maNCC=?', p.id); if (!ncc) fail(404, 'Không tìm thấy nhà cung cấp');
  const don = await get("SELECT maDonHang FROM DonDatHang WHERE maNCC=? AND trangThai<>'DaHoanTat'", p.id);
  if (don) fail(409, `${ncc.tenNCC} còn đơn đặt hàng chưa hoàn tất (${don.maDonHang}).`);
  await run("UPDATE NhaCungCap SET trangThai='NgungHopTac' WHERE maNCC=?", p.id);
  await log(req.user, 'Xoa', 'NhaCungCap', p.id, 'Xóa nhà cung cấp ' + ncc.tenNCC); return { ok: true };
});

// UC 7.1 – Đơn đặt hàng
api('GET', '/api/donhang', 'any', async (req) => {
  let sql = `SELECT d.*, n.tenNCC, t.hoTen nguoiLap, (SELECT COUNT(*) FROM ChiTietDonDatHang c WHERE c.maDonHang=d.maDonHang) soMatHang
             FROM DonDatHang d JOIN NhaCungCap n ON n.maNCC=d.maNCC JOIN TaiKhoan t ON t.maTaiKhoan=d.maNguoiLap`;
  const p = []; if (req.query.trangThai) { sql += ' WHERE d.trangThai=?'; p.push(req.query.trangThai); }
  return await all(sql + ' ORDER BY d.ngayDat DESC', ...p);
});
api('GET', '/api/donhang/:id', 'any', async (req, b, res, p) => {
  const d = await get('SELECT d.*, n.tenNCC, n.soDienThoai sdtNCC, n.diaChi, t.hoTen nguoiLap FROM DonDatHang d JOIN NhaCungCap n ON n.maNCC=d.maNCC JOIN TaiKhoan t ON t.maTaiKhoan=d.maNguoiLap WHERE maDonHang=?', p.id);
  if (!d) fail(404, 'Không tìm thấy đơn');
  d.chiTiet = await all('SELECT c.*, nl.tenNguyenLieu, nl.donViTinh, nl.soLuongTon FROM ChiTietDonDatHang c JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu WHERE maDonHang=?', p.id);
  return d;
});
api('GET', '/api/dexuat', 'QuanLy', async () =>
  await all("SELECT maNguyenLieu, tenNguyenLieu, donViTinh, soLuongTon, mucToiDa - soLuongTon soLuongDeXuat FROM NguyenLieu WHERE soLuongTon < mucToiThieu AND trangThai='DangSuDung'"));
function kiemTraDon(b) {
  if (!b.maNCC) fail(400, 'Vui lòng chọn nhà cung cấp');
  if (!Array.isArray(b.chiTiet) || !b.chiTiet.length) fail(400, 'Đơn đặt hàng chưa có nguyên vật liệu');
  for (const c of b.chiTiet) if (!Number.isInteger(+c.soLuongDat) || +c.soLuongDat <= 0) fail(400, 'Số lượng không hợp lệ', { maNguyenLieu: c.maNguyenLieu });
}
api('POST', '/api/donhang', 'QuanLy', async (req, b) => tx(async () => {
  kiemTraDon(b); const ma = await nextId('DonDatHang', 'maDonHang', 'DH-');
  await run('INSERT INTO DonDatHang (maDonHang,ngayDat,trangThai,ghiChu,maNCC,maNguoiLap) VALUES (?,?,?,?,?,?)', ma, now(), 'ChoDatHang', b.ghiChu || null, b.maNCC, req.user.maTaiKhoan);
  for (const c of b.chiTiet) await run('INSERT INTO ChiTietDonDatHang VALUES (?,?,?,NULL)', ma, c.maNguyenLieu, +c.soLuongDat);
  await log(req.user, 'Them', 'DonDatHang', ma, 'Tạo đơn đặt hàng ' + ma); return { ok: true, maDonHang: ma };
}));
api('PUT', '/api/donhang/:id', 'QuanLy', async (req, b, res, p) => tx(async () => {
  const d = await get('SELECT * FROM DonDatHang WHERE maDonHang=?', p.id);
  if (!d || d.trangThai !== 'ChoDatHang') fail(400, 'Chỉ sửa được đơn ở trạng thái Chờ đặt hàng');
  b.maNCC = d.maNCC; kiemTraDon(b);
  await run('DELETE FROM ChiTietDonDatHang WHERE maDonHang=?', p.id);
  for (const c of b.chiTiet) await run('INSERT INTO ChiTietDonDatHang VALUES (?,?,?,NULL)', p.id, c.maNguyenLieu, +c.soLuongDat);
  await log(req.user, 'Sua', 'DonDatHang', p.id, 'Chỉnh sửa đơn đặt hàng ' + p.id); return { ok: true };
}));
api('POST', '/api/donhang/:id/dadat', 'QuanLy', async (req, b, res, p) => {
  const d = await get('SELECT * FROM DonDatHang WHERE maDonHang=?', p.id);
  if (!d || d.trangThai !== 'ChoDatHang') fail(400, 'Đơn không ở trạng thái Chờ đặt hàng');
  await run("UPDATE DonDatHang SET trangThai='DaDatHang' WHERE maDonHang=?", p.id);
  await log(req.user, 'Sua', 'DonDatHang', p.id, 'Đánh dấu đã gửi đơn ' + p.id + ' cho nhà cung cấp'); return { ok: true };
});

// UC 3 – Nhập kho (nhân viên lập phiếu từ đơn Đã đặt hàng)
api('POST', '/api/phieunhap', 'any', async (req, b) => tx(async () => {
  const d = await get("SELECT * FROM DonDatHang WHERE maDonHang=? AND trangThai='DaDatHang'", b.maDonHang);
  if (!d) fail(400, 'Đơn không ở trạng thái chờ nhập');
  if (await get("SELECT 1 FROM PhieuNhapKho WHERE maDonHang=? AND trangThai<>'DaXacNhan'", b.maDonHang)) fail(409, 'Đơn này đã có phiếu nhập đang chờ quản lý xác nhận');
  const ctDon = await all('SELECT * FROM ChiTietDonDatHang WHERE maDonHang=?', b.maDonHang);
  const items = b.chiTiet || [];
  if (items.length !== ctDon.length || items.some(i => i.soLuongThucNhan === '' || i.soLuongThucNhan == null)) fail(400, 'Vui lòng nhập số lượng thực nhận');
  for (const i of items) {
    if (!Number.isInteger(+i.soLuongThucNhan) || +i.soLuongThucNhan < 0) fail(400, 'Số lượng không hợp lệ', { maNguyenLieu: i.maNguyenLieu });
    if (+i.soLuongThucNhan > 0) {
      if (!i.soLo || !i.ngaySanXuat || !i.hanSuDung) fail(400, 'Vui lòng nhập đầy đủ số lô, ngày sản xuất, hạn sử dụng', { maNguyenLieu: i.maNguyenLieu });
      if (i.ngaySanXuat > today() || i.hanSuDung <= i.ngaySanXuat) fail(400, 'Thông tin lô hoặc hạn sử dụng không hợp lệ', { maNguyenLieu: i.maNguyenLieu });
      if (i.hanSuDung <= today()) fail(400, 'Hàng đã hết hạn, không thể nhập kho', { maNguyenLieu: i.maNguyenLieu });
    }
  }
  const ma = await nextId('PhieuNhapKho', 'maPhieuNhap', 'PN-');
  const anh = saveImage(b.hinhAnhHoaDon);
  const coSaiLech = (b.saiLech || []).length > 0;
  await run('INSERT INTO PhieuNhapKho (maPhieuNhap,ngayNhap,hinhAnhHoaDon,trangThai,ghiChu,maDonHang,maNguoiLap) VALUES (?,?,?,?,?,?,?)',
    ma, now(), anh, coSaiLech ? 'ChoXuLy' : 'ChoXacNhan', b.ghiChu || null, b.maDonHang, req.user.maTaiKhoan);
  for (const i of items) {
    const don = ctDon.find(c => c.maNguyenLieu === i.maNguyenLieu);
    await run('INSERT INTO ChiTietPhieuNhap VALUES (?,?,?,?,?,1)', ma, i.maNguyenLieu, +i.soLuongThucNhan, don ? don.soLuongDat : null, null);
    if (+i.soLuongThucNhan > 0)
      await run('INSERT INTO LoHang VALUES (?,?,?,?,?,0,?,?)', await nextId('LoHang', 'maLo', 'LO-'), i.soLo, i.ngaySanXuat, i.hanSuDung, +i.soLuongThucNhan, ma, i.maNguyenLieu);
  }
  for (const s of (b.saiLech || [])) {
    if (!s.lyDo || !(+s.soLuongSaiLech > 0)) fail(400, 'Vui lòng chọn lý do và nhập số lượng sai lệch');
    const anhSL = (s.anh || []).filter(Boolean);
    if (!anhSL.length) fail(400, 'Vui lòng đính kèm ít nhất một ảnh minh chứng');
    const maSL = await nextId('SaiLechHangNhap', 'maSaiLech', 'SL-');
    await run('INSERT INTO SaiLechHangNhap (maSaiLech,soLuongSaiLech,lyDo,ngayGhiNhan,maPhieuNhap,maNguyenLieu) VALUES (?,?,?,?,?,?)', maSL, +s.soLuongSaiLech, s.lyDo, now(), ma, s.maNguyenLieu);
    for (const a of anhSL) await run('INSERT INTO AnhMinhChung VALUES (?,?,?)', await nextId('AnhMinhChung', 'maAnh', 'ANH-'), saveImage(a), maSL);
  }
  await log(req.user, 'Them', 'PhieuNhapKho', ma, 'Tạo phiếu nhập ' + ma + ' từ đơn ' + b.maDonHang);
  return { ok: true, maPhieuNhap: ma };
}));

// UC 4 – Xuất kho (có xử lý thiếu hàng UC 4.2)
api('GET', '/api/phieuxuat', 'any', async () => await all(`SELECT p.*, t.hoTen nguoiLap, (SELECT COUNT(*) FROM ChiTietPhieuXuat c WHERE c.maPhieuXuat=p.maPhieuXuat) soMatHang
  FROM PhieuXuatKho p JOIN TaiKhoan t ON t.maTaiKhoan=p.maNguoiLap ORDER BY p.ngayXuat DESC, p.maPhieuXuat DESC`));
api('POST', '/api/phieuxuat', 'any', async (req, b) => tx(async () => {
  if (!b.lyDoXuat) fail(400, 'Vui lòng chọn lý do xuất');
  const items = b.chiTiet || []; if (!items.length) fail(400, 'Chưa có nguyên liệu nào trong phiếu');
  const thieu = [];
  for (const i of items) {
    const nl = await get('SELECT * FROM NguyenLieu WHERE maNguyenLieu=?', i.maNguyenLieu);
    if (!nl) fail(400, 'Tên nguyên liệu không tồn tại, vui lòng kiểm tra lại!');
    if (!(+i.soLuong > 0)) fail(400, 'Số lượng xuất phải lớn hơn 0!');
    if (+i.soLuong > nl.soLuongTon) thieu.push({ maNguyenLieu: nl.maNguyenLieu, tenNguyenLieu: nl.tenNguyenLieu, donViTinh: nl.donViTinh, yeuCau: +i.soLuong, ton: nl.soLuongTon });
  }
  if (thieu.length && !b.phuongAn) fail(409, 'Thiếu hàng trong kho', { thieu });
  const ma = await nextId('PhieuXuatKho', 'maPhieuXuat', 'PX-');
  const choBoSung = thieu.length && b.phuongAn === 'ChoBoSung';
  await run('INSERT INTO PhieuXuatKho (maPhieuXuat,ngayXuat,lyDoXuat,trangThai,maNguoiLap) VALUES (?,?,?,?,?)', ma, now(), b.lyDoXuat, choBoSung ? 'ChoBoSungHang' : 'ChoXacNhan', req.user.maTaiKhoan);
  for (const i of items) {
    const t = thieu.find(x => x.maNguyenLieu === i.maNguyenLieu);
    let thuc = +i.soLuong, tt = 'Du';
    if (t) { if (choBoSung) { thuc = 0; tt = 'ChoBoSung'; } else { thuc = t.ton; tt = 'LayPhanConLai'; } }
    await run('INSERT INTO ChiTietPhieuXuat VALUES (?,?,?,?,?)', ma, i.maNguyenLieu, +i.soLuong, thuc, tt);
  }
  await log(req.user, 'Them', 'PhieuXuatKho', ma, 'Tạo phiếu xuất ' + ma + (choBoSung ? ' (chờ bổ sung hàng)' : ''));
  return { ok: true, maPhieuXuat: ma, choBoSung: !!choBoSung };
}));

// UC 6.1 / 6.2 – Quản lý kiểm tra phiếu
api('GET', '/api/kiemtra/nhap', 'QuanLy', async (req) => await all(`SELECT p.*, t.hoTen nguoiLap FROM PhieuNhapKho p JOIN TaiKhoan t ON t.maTaiKhoan=p.maNguoiLap
  WHERE p.trangThai IN ('ChoXacNhan','ChoXuLy') AND p.maPhieuNhap LIKE ? ORDER BY p.ngayNhap DESC`, '%' + (req.query.q || '') + '%'));
api('GET', '/api/kiemtra/xuat', 'QuanLy', async (req) => await all(`SELECT p.*, t.hoTen nguoiLap FROM PhieuXuatKho p JOIN TaiKhoan t ON t.maTaiKhoan=p.maNguoiLap
  WHERE p.trangThai='ChoXacNhan' AND p.maPhieuXuat LIKE ? ORDER BY p.ngayXuat DESC`, '%' + (req.query.q || '') + '%'));
api('GET', '/api/phieunhap/:id', 'any', async (req, b, res, p) => {
  const pn = await get('SELECT p.*, t.hoTen nguoiLap, n.tenNCC FROM PhieuNhapKho p JOIN TaiKhoan t ON t.maTaiKhoan=p.maNguoiLap LEFT JOIN DonDatHang d ON d.maDonHang=p.maDonHang LEFT JOIN NhaCungCap n ON n.maNCC=d.maNCC WHERE maPhieuNhap=?', p.id);
  if (!pn) fail(404, 'Không tìm thấy phiếu');
  pn.chiTiet = await all(`SELECT c.*, nl.tenNguyenLieu, nl.donViTinh, l.soLo, l.ngaySanXuat, l.hanSuDung FROM ChiTietPhieuNhap c
    JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu LEFT JOIN LoHang l ON l.maPhieuNhap=c.maPhieuNhap AND l.maNguyenLieu=c.maNguyenLieu WHERE c.maPhieuNhap=?`, p.id);
  pn.saiLech = await all('SELECT s.*, nl.tenNguyenLieu FROM SaiLechHangNhap s JOIN NguyenLieu nl ON nl.maNguyenLieu=s.maNguyenLieu WHERE maPhieuNhap=?', p.id);
  for (const s of pn.saiLech) s.anh = (await all('SELECT duongDan FROM AnhMinhChung WHERE maSaiLech=?', s.maSaiLech)).map(a => a.duongDan);
  return pn;
});
api('GET', '/api/phieuxuat/:id', 'any', async (req, b, res, p) => {
  const px = await get('SELECT p.*, t.hoTen nguoiLap FROM PhieuXuatKho p JOIN TaiKhoan t ON t.maTaiKhoan=p.maNguoiLap WHERE maPhieuXuat=?', p.id);
  if (!px) fail(404, 'Không tìm thấy phiếu');
  px.chiTiet = await all('SELECT c.*, nl.tenNguyenLieu, nl.donViTinh, nl.soLuongTon FROM ChiTietPhieuXuat c JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu WHERE maPhieuXuat=?', p.id);
  return px;
});
api('POST', '/api/phieunhap/:id/xacnhan', 'QuanLy', async (req, b, res, p) => tx(async () => {
  const pn = await get("SELECT * FROM PhieuNhapKho WHERE maPhieuNhap=? AND trangThai IN ('ChoXacNhan','ChoXuLy')", p.id);
  if (!pn) fail(400, 'Có lỗi xảy ra');
  for (const l of await all('SELECT * FROM LoHang WHERE maPhieuNhap=?', p.id)) {
    await run('UPDATE LoHang SET soLuongCon=soLuongNhap WHERE maLo=?', l.maLo);
    await capNhatTon(l.maNguyenLieu, l.soLuongNhap);
  }
  await run("UPDATE PhieuNhapKho SET trangThai='DaXacNhan', ngayDuyet=?, maNguoiDuyet=? WHERE maPhieuNhap=?", now(), req.user.maTaiKhoan, p.id);
  if (pn.maDonHang) await run("UPDATE DonDatHang SET trangThai='DaHoanTat' WHERE maDonHang=?", pn.maDonHang);
  await log(req.user, 'XacNhan', 'PhieuNhapKho', p.id, 'Quản lý xác nhận phiếu nhập ' + p.id); return { ok: true };
}));
api('POST', '/api/phieuxuat/:id/xacnhan', 'QuanLy', async (req, b, res, p) => tx(async () => {
  const px = await get("SELECT * FROM PhieuXuatKho WHERE maPhieuXuat=? AND trangThai='ChoXacNhan'", p.id);
  if (!px) fail(400, 'Có lỗi xảy ra');
  for (const c of await all('SELECT * FROM ChiTietPhieuXuat WHERE maPhieuXuat=?', p.id)) {
    const nl = await get('SELECT * FROM NguyenLieu WHERE maNguyenLieu=?', c.maNguyenLieu);
    if (c.soLuongThucXuat > nl.soLuongTon) fail(409, `Tồn kho ${nl.tenNguyenLieu} không còn đủ để xuất`);
    let canXuat = c.soLuongThucXuat; // trừ theo lô gần hết hạn trước (FEFO)
    for (const l of await all('SELECT * FROM LoHang WHERE maNguyenLieu=? AND soLuongCon>0 ORDER BY hanSuDung', c.maNguyenLieu)) {
      if (!canXuat) break; const lay = Math.min(canXuat, l.soLuongCon);
      await run('UPDATE LoHang SET soLuongCon=soLuongCon-? WHERE maLo=?', lay, l.maLo); canXuat -= lay;
    }
    await capNhatTon(c.maNguyenLieu, -c.soLuongThucXuat);
  }
  await run("UPDATE PhieuXuatKho SET trangThai='DaXacNhan', ngayDuyet=?, maNguoiDuyet=? WHERE maPhieuXuat=?", now(), req.user.maTaiKhoan, p.id);
  await log(req.user, 'XacNhan', 'PhieuXuatKho', p.id, 'Quản lý xác nhận phiếu xuất ' + p.id); return { ok: true };
}));

// UC 6.4 – Cảnh báo
api('GET', '/api/canhbao', 'QuanLy', async () => await all('SELECT c.*, nl.tenNguyenLieu, nl.donViTinh, nl.mucToiThieu FROM CanhBaoTonKho c JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu ORDER BY c.thoiGianCanhBao DESC'));
api('POST', '/api/canhbao/daxem', 'QuanLy', async () => { await run("UPDATE CanhBaoTonKho SET trangThai='DaXem' WHERE trangThai='ChoQuanLyXem'"); return { ok: true }; });

// UC 6.0 – Tổng hợp quản lý tồn kho
api('GET', '/api/quanlytonkho', 'QuanLy', async () => ({
  nhapCho: (await get("SELECT COUNT(*) n FROM PhieuNhapKho WHERE trangThai IN ('ChoXacNhan','ChoXuLy')")).n,
  xuatCho: (await get("SELECT COUNT(*) n FROM PhieuXuatKho WHERE trangThai='ChoXacNhan'")).n,
  // phiếu xuất đã làm phát sinh cảnh báo gần nhất (cảnh báo được tạo cùng lúc quản lý xác nhận phiếu xuất)
  pxGanNhat: (await get(`SELECT p.maPhieuXuat FROM CanhBaoTonKho c JOIN PhieuXuatKho p ON p.trangThai='DaXacNhan' AND p.ngayDuyet=c.thoiGianCanhBao
    JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu AND nl.soLuongTon < nl.mucToiThieu ORDER BY c.thoiGianCanhBao DESC LIMIT 1`) || {}).maPhieuXuat || null,
  duoiMuc: await all(`SELECT nl.maNguyenLieu, nl.tenNguyenLieu, nl.donViTinh, nl.soLuongTon, nl.mucToiThieu,
      EXISTS(SELECT 1 FROM CanhBaoTonKho c WHERE c.maNguyenLieu=nl.maNguyenLieu AND c.trangThai='ChoQuanLyXem') choXem
    FROM NguyenLieu nl WHERE nl.soLuongTon < nl.mucToiThieu AND nl.trangThai='DangSuDung' ORDER BY nl.soLuongTon`)
}));
// UC 9 – dữ liệu biểu đồ: số lượng nhập / xuất theo ngày của một nguyên vật liệu (chỉ phiếu đã xác nhận)
api('GET', '/api/baocao/bieudo', 'QuanLy', async (req) => { const [tu, den] = kyBaoCao(req.query);
  return await all(`SELECT ngay, SUM(nhap) nhap, SUM(xuat) xuat FROM (
      SELECT date(p.ngayNhap) ngay, c.soLuongThucNhan nhap, 0 xuat FROM PhieuNhapKho p JOIN ChiTietPhieuNhap c ON c.maPhieuNhap=p.maPhieuNhap
        WHERE p.trangThai='DaXacNhan' AND c.maNguyenLieu=?1
      UNION ALL SELECT date(p.ngayXuat), 0, c.soLuongThucXuat FROM PhieuXuatKho p JOIN ChiTietPhieuXuat c ON c.maPhieuXuat=p.maPhieuXuat
        WHERE p.trangThai='DaXacNhan' AND c.maNguyenLieu=?1)
    WHERE ngay BETWEEN ?2 AND ?3 GROUP BY ngay ORDER BY ngay`, String(req.query.ma || ''), tu, den); });
// UC 9 – ghi nhận việc xuất báo cáo vào nhật ký
api('POST', '/api/baocao/ghinhan', 'QuanLy', async (req, b) => {
  await log(req.user, 'XuatFile', 'BaoCao', String(b.tenFile || ''), String(b.noiDung || 'Xuất báo cáo').slice(0, 500)); return { ok: true };
});

// UC 5 – Lịch sử (chỉ phiếu đã xác nhận)
api('GET', '/api/lichsu/nhap', 'any', async () => await all(`SELECT p.maPhieuNhap maPhieu, p.ngayNhap ngay, nl.tenNguyenLieu, c.soLuongThucNhan soLuong, nl.donViTinh
  FROM PhieuNhapKho p JOIN ChiTietPhieuNhap c ON c.maPhieuNhap=p.maPhieuNhap JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu
  WHERE p.trangThai='DaXacNhan' ORDER BY p.ngayNhap DESC`));
api('GET', '/api/lichsu/xuat', 'any', async () => await all(`SELECT p.maPhieuXuat maPhieu, p.ngayXuat ngay, nl.tenNguyenLieu, c.soLuongThucXuat soLuong, nl.donViTinh
  FROM PhieuXuatKho p JOIN ChiTietPhieuXuat c ON c.maPhieuXuat=p.maPhieuXuat JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu
  WHERE p.trangThai='DaXacNhan' ORDER BY p.ngayXuat DESC`));

// UC 9 – Báo cáo
function kyBaoCao(q) {
  const tu = q.tu || '0000-01-01', den = q.den || '9999-12-31';
  if (tu > den) fail(400, 'Khoảng thời gian không hợp lệ!');
  return [tu, den];
}
api('GET', '/api/baocao/nhap', 'QuanLy', async (req) => { const [tu, den] = kyBaoCao(req.query);
  return await all(`SELECT nl.tenNguyenLieu, SUM(c.soLuongThucNhan) soLuong, nl.donViTinh, date(p.ngayNhap) ngay FROM PhieuNhapKho p
    JOIN ChiTietPhieuNhap c ON c.maPhieuNhap=p.maPhieuNhap JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu
    WHERE p.trangThai='DaXacNhan' AND date(p.ngayNhap) BETWEEN ? AND ? GROUP BY nl.maNguyenLieu, date(p.ngayNhap) ORDER BY ngay`, tu, den); });
api('GET', '/api/baocao/xuat', 'QuanLy', async (req) => { const [tu, den] = kyBaoCao(req.query);
  return await all(`SELECT nl.tenNguyenLieu, SUM(c.soLuongThucXuat) soLuong, nl.donViTinh, date(p.ngayXuat) ngay FROM PhieuXuatKho p
    JOIN ChiTietPhieuXuat c ON c.maPhieuXuat=p.maPhieuXuat JOIN NguyenLieu nl ON nl.maNguyenLieu=c.maNguyenLieu
    WHERE p.trangThai='DaXacNhan' AND date(p.ngayXuat) BETWEEN ? AND ? GROUP BY nl.maNguyenLieu, date(p.ngayXuat) ORDER BY ngay`, tu, den); });
api('GET', '/api/baocao/ton', 'QuanLy', async (req) => { const [tu, den] = kyBaoCao(req.query);
  return await all(`WITH N AS (SELECT c.maNguyenLieu,
        SUM(CASE WHEN date(p.ngayNhap) BETWEEN ?1 AND ?2 THEN c.soLuongThucNhan ELSE 0 END) nhap,
        SUM(CASE WHEN date(p.ngayNhap) > ?2 THEN c.soLuongThucNhan ELSE 0 END) nhapSau
      FROM ChiTietPhieuNhap c JOIN PhieuNhapKho p ON p.maPhieuNhap=c.maPhieuNhap WHERE p.trangThai='DaXacNhan' GROUP BY c.maNguyenLieu),
    X AS (SELECT c.maNguyenLieu,
        SUM(CASE WHEN date(p.ngayXuat) BETWEEN ?1 AND ?2 THEN c.soLuongThucXuat ELSE 0 END) xuat,
        SUM(CASE WHEN date(p.ngayXuat) > ?2 THEN c.soLuongThucXuat ELSE 0 END) xuatSau
      FROM ChiTietPhieuXuat c JOIN PhieuXuatKho p ON p.maPhieuXuat=c.maPhieuXuat WHERE p.trangThai='DaXacNhan' GROUP BY c.maNguyenLieu)
    SELECT nl.tenNguyenLieu, nl.donViTinh,
      nl.soLuongTon - IFNULL(N.nhapSau,0) + IFNULL(X.xuatSau,0) - IFNULL(N.nhap,0) + IFNULL(X.xuat,0) tonDau,
      IFNULL(N.nhap,0) nhap, IFNULL(X.xuat,0) xuat,
      nl.soLuongTon - IFNULL(N.nhapSau,0) + IFNULL(X.xuatSau,0) tonCuoi
    FROM NguyenLieu nl LEFT JOIN N ON N.maNguyenLieu=nl.maNguyenLieu LEFT JOIN X ON X.maNguyenLieu=nl.maNguyenLieu
    WHERE nl.trangThai='DangSuDung' ORDER BY nl.tenNguyenLieu`, tu, den); });
api('GET', '/api/baocao/nhatky', 'QuanLy', async (req) => { const [tu, den] = kyBaoCao(req.query);
  return await all(`SELECT t.hoTen nguoiThucHien, n.thoiGian, n.noiDungChiTiet noiDung FROM NhatKyHeThong n JOIN TaiKhoan t ON t.maTaiKhoan=n.maTaiKhoan
    WHERE date(n.thoiGian) BETWEEN ? AND ? ORDER BY n.thoiGian DESC LIMIT 500`, tu, den); });

// UC 10 – Tài khoản
api('GET', '/api/taikhoan', 'QuanLy', async () => await all(`SELECT t.maTaiKhoan, t.hoTen, t.soDienThoai, t.ngayTao, IFNULL(pq.tenPhanQuyen,'Chưa phân quyền') quyen, tp.maPhanQuyen
  FROM TaiKhoan t LEFT JOIN TaiKhoan_PhanQuyen tp ON tp.maTaiKhoan=t.maTaiKhoan LEFT JOIN PhanQuyen pq ON pq.maPhanQuyen=tp.maPhanQuyen ORDER BY t.maTaiKhoan`));
api('POST', '/api/taikhoan', 'QuanLy', async (req, b) => {
  if (!String(b.hoTen || '').trim() || !String(b.soDienThoai || '').trim() || !String(b.matKhau || '')) fail(400, 'Vui lòng nhập đầy đủ thông tin');
  const sdt = b.soDienThoai.replace(/\s/g, '');
  if (!/^0\d{9}$/.test(sdt)) fail(400, 'Số điện thoại không hợp lệ');
  if (await get('SELECT 1 FROM TaiKhoan WHERE soDienThoai=?', sdt)) fail(409, 'Số điện thoại đã được đăng ký', { soDienThoai: sdt });
  const ma = await nextId('TaiKhoan', 'maTaiKhoan', 'TK', 3);
  await run('INSERT INTO TaiKhoan (maTaiKhoan,hoTen,soDienThoai,matKhau,ngayTao) VALUES (?,?,?,?,?)', ma, b.hoTen.trim(), sdt, hashPassword(b.matKhau), today());
  await log(req.user, 'Them', 'TaiKhoan', ma, 'Tạo tài khoản ' + b.hoTen); return { ok: true, maTaiKhoan: ma };
});
api('PUT', '/api/taikhoan/:id/quyen', 'QuanLy', async (req, b, res, p) => tx(async () => {
  if (!['QuanLy', 'NhanVien'].includes(b.maPhanQuyen)) fail(400, 'Vui lòng chọn ít nhất một quyền cho tài khoản');
  await run('DELETE FROM TaiKhoan_PhanQuyen WHERE maTaiKhoan=?', p.id);
  await run('INSERT INTO TaiKhoan_PhanQuyen VALUES (?,?)', p.id, b.maPhanQuyen);
  await log(req.user, 'Sua', 'TaiKhoan_PhanQuyen', p.id, `Phân quyền ${b.maPhanQuyen} cho tài khoản ${p.id}`); return { ok: true };
}));

// ---------- máy chủ HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
function cookie(req, name) { const m = new RegExp('(?:^|; )' + name + '=([^;]+)').exec(req.headers.cookie || ''); return m ? m[1] : null; }
function send(res, status, obj) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  // Trên Vercel phần thân yêu cầu có thể đã được đọc sẵn vào req.body
  if (req.readableEnded || req.complete && req.body !== undefined) {
    const b = req.body; return Promise.resolve(b == null ? '' : typeof b === 'string' ? b : Buffer.isBuffer(b) ? b.toString() : JSON.stringify(b));
  }
  return new Promise((ok, no) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 30e6) req.destroy(); }); req.on('end', () => ok(raw)); req.on('error', no); });
}

async function handleApi(req, res, url) {
  try {
    // Trên Vercel, mọi đường dẫn /api/... được chuyển về 1 hàm; đường dẫn gốc nằm trong req.url hoặc tham số __p
    let pathname = url.pathname;
    if (url.searchParams.has('__p') && (pathname === '/api' || pathname === '/api/index' || pathname === '/api/index.js')) pathname = '/api/' + url.searchParams.get('__p');
    url.searchParams.delete('__p');
    const raw = await readBody(req);
    try { await db.init(); } catch (e) { console.error(e); fail(500, 'Không kết nối được cơ sở dữ liệu. ' + e.message); }
    const r = routes.find(r => r.method === req.method && r.re.test(pathname));
    if (!r) fail(404, 'Không tìm thấy');
    const params = {}; const m = r.re.exec(pathname); r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
    req.query = Object.fromEntries(url.searchParams);
    if (r.role) {
      const ma = docPhien(cookie(req, 'sid')); if (!ma) fail(401, 'Vui lòng đăng nhập');
      const tk = await get('SELECT * FROM TaiKhoan WHERE maTaiKhoan=?', ma);
      if (!tk || tk.trangThai !== 'HoatDong') fail(401, 'Vui lòng đăng nhập');
      req.user = { ...tk, role: await roleOf(ma) };
      if (r.role === 'QuanLy' && req.user.role !== 'QuanLy') fail(403, 'Chỉ tài khoản quản lý mới dùng được chức năng này');
    }
    const body = raw ? JSON.parse(raw) : {};
    send(res, 200, await r.handler(req, body, res, params));
  } catch (e) {
    if (e instanceof HttpError) send(res, e.status, { error: e.message, ...(e.data || {}) });
    else { console.error(e); send(res, 500, { error: 'Có lỗi xảy ra, vui lòng thử lại!' }); }
  }
}

async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  // tệp tĩnh (khi chạy trên máy; trên Vercel thư mục public được phục vụ trực tiếp)
  let file = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const base = file.startsWith('/uploads/') ? __dirname : path.join(__dirname, 'public');
  const full = path.normalize(path.join(base, file));
  if (!full.startsWith(base) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}
module.exports = handler;

// Chạy trên máy: node server.js (hoặc start-windows.bat)
if (require.main === module) {
  http.createServer(handler).listen(PORT, async () => {
    try { await db.init(); } catch (e) { console.error('Không kết nối được cơ sở dữ liệu:', e.message); }
    console.log('==============================================');
    console.log(' Hệ thống quản lý kho WinKids đang chạy');
    console.log(` Cơ sở dữ liệu: ${db.kind === 'turso' ? 'Turso (trên mạng)' : 'file winkids.db (trên máy)'}`);
    console.log(` Mở trình duyệt: http://localhost:${PORT}`);
    console.log(' Quản lý:   0905100001 / 123456');
    console.log(' Nhân viên: 0905100002 / 123456');
    console.log(' Nhấn Ctrl + C để tắt');
    console.log('==============================================');
  });
}
