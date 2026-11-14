/* Giao diện WinKids – bám theo các màn hình Figma đã chốt */
const S = { me: null };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fd = s => { if (!s) return ''; const [d, t] = String(s).split(' '); const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const fdt = s => s ? fd(s) + ' ' + String(s).slice(11, 16) : '';
const todayISO = () => new Date().toISOString().slice(0, 10);

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { S.me = null; location.hash = '#/login'; }
  if (!r.ok) throw { status: r.status, ...data };
  return data;
}
function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3500);
}
function modal(html, cls = '') {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  document.body.appendChild(o);
  const close = () => o.remove();
  $$('[data-close]', o).forEach(b => b.onclick = close);
  return { el: o, close };
}
function notice(kind, title, text) {
  const color = { ok: '#1E7A4A', warn: '#F59A23', err: '#B3261E', info: '#4A5E80' }[kind];
  const icon = { ok: '✓', warn: '⏱', err: '!', info: '!' }[kind];
  const big = kind === 'err' ? `<div class="big err-i"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg></div>` : `<div class="big" style="background:${color}">${icon}</div>`;
  const m = modal(`<div class="notice ${kind === 'err' ? 'n-err' : ''}">${big}<h3>${esc(title)}</h3>${text ? `<p class="muted">${esc(text)}</p>` : ''}
    <div class="acts" style="justify-content:center"><button class="btn o" data-close>Đóng</button></div></div>`, kind === 'err' ? 'narrow' : '');
  m.el.classList.add('keep');
  if (kind === 'ok' || kind === 'info') setTimeout(m.close, 2500);
}
// Ảnh được thu nhỏ (cạnh dài tối đa 1600px) và nén JPEG trước khi gửi, để lưu được trong cơ sở dữ liệu
const fileToDataUrl = f => new Promise((ok, no) => {
  if (!f) return no('Chưa chọn ảnh.');
  if (!/^image\/(png|jpe?g)$/.test(f.type)) return no('Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG hoặc PNG.');
  if (f.size > 20 * 1024 * 1024) return no('Ảnh vượt quá 20MB.');
  const r = new FileReader(); r.onerror = () => no('Không đọc được ảnh');
  r.onload = () => {
    const img = new Image(); img.onerror = () => no('Không đọc được ảnh');
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.8, out = c.toDataURL('image/jpeg', q);
      while (out.length > 900e3 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      ok(out);
    };
    img.src = r.result;
  };
  r.readAsDataURL(f);
});
const badge = tt => {
  const m = {
    ChoXacNhan: ['Chờ xác nhận', 'b-blue'], ChoXuLy: ['Chờ xử lý', 'b-amber'], DaXacNhan: ['Đã xác nhận', 'b-green'],
    ChoBoSungHang: ['Chờ bổ sung hàng', 'b-amber'], ChoDatHang: ['Chờ đặt hàng', 'b-amber'], DaDatHang: ['Đã đặt hàng', 'b-blue'],
    DaHoanTat: ['Đã hoàn tất', 'b-green'], Du: ['Đủ hàng', 'b-green'], LayPhanConLai: ['Lấy phần còn lại', 'b-amber'], ChoBoSung: ['Chờ bổ sung', 'b-red'],
    ChoQuanLyXem: ['Chờ quản lý xem', 'b-red'], DaXem: ['Đã xem', 'b-gray'], 'Quản lý': ['Quản lý', 'b-blue'], 'Nhân viên': ['Nhân viên', 'b-green'], 'Chưa phân quyền': ['Chưa phân quyền', 'b-gray']
  }[tt] || [tt, 'b-gray'];
  return `<span class="badge ${m[1]}">${esc(m[0])}</span>`;
};
const table = (cols, rows, emptyText = 'Không có dữ liệu', rowCls = () => '') =>
  `<table><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr class="${rowCls(r)}">${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols.length}" class="empty">🔍<br>${esc(emptyText)}</td></tr>`}</tbody></table>`;
function csv(name, header, rows) {
  const s = '\ufeff' + [header, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv' })); a.download = name; a.click();
}

/* ---------- icon ---------- */
const I = n => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${{
  home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  in: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', out: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"/>', ware: '<path d="M3 21V9l9-6 9 6v12M8 21v-7h8v7"/>',
  truck: '<path d="M1 6h13v10H1zM14 10h4l3 3v3h-7"/><circle cx="5" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  chart: '<path d="M5 21V10M12 21V3M19 21v-8"/>', user: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0114 0v1M17 4a4 4 0 010 8M22 21v-1a6 6 0 00-4-5.6"/>',
  bell: '<path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0"/>', chev: '<path d="M6 9l6 6 6-6"/>'
}[n]}</svg>`;

/* ---------- thanh bên theo quyền ---------- */
function menuFor(role) {
  const ton = role === 'QuanLy'
    ? [['Quản lý tồn kho', '#/quanlytonkho'], ['Tra cứu thông tin', '#/tracuu'], ['Xem lịch sử tồn kho', '#/lichsu']]
    : [['Tra cứu thông tin', '#/tracuu'], ['Xem lịch sử tồn kho', '#/lichsu']];
  const m = [['Tổng quan', '#/tongquan', 'home'], ['Nhập kho', null, 'in', [['Kiểm tra hàng nhập', '#/nhapkho']]], ['Xuất kho', '#/xuatkho', 'out']];
  if (role === 'QuanLy') m.push(['Hàng hóa', '#/hanghoa', 'box']);
  m.push(['Tồn kho', null, 'ware', ton]);
  if (role === 'QuanLy') m.push(['Nhà cung cấp', null, 'truck', [['Đơn đặt hàng', '#/donhang'], ['Thêm NCC', '#/ncc/them'], ['Sửa NCC', '#/ncc/sua'], ['Xóa NCC', '#/ncc/xoa']]],
    ['Báo cáo', '#/baocao', 'chart'], ['Tài khoản', '#/taikhoan', 'user']);
  return m;
}
/* Đường dẫn (breadcrumb): mỗi mục, trừ trang đang mở, bấm vào để quay về */
const CRUMB_LINK = {
  'Kho': '#/tongquan', 'Tổng quan': '#/tongquan', 'Nhập kho': '#/nhapkho', 'Kiểm tra hàng nhập': '#/nhapkho', 'Xuất kho': '#/xuatkho',
  'Hàng hóa': '#/hanghoa', 'Quản lý tồn kho': '#/quanlytonkho', 'Kiểm tra phiếu nhập': '#/kiemtra/nhap', 'Kiểm tra phiếu xuất': '#/kiemtra/xuat',
  'Theo dõi tồn kho': '#/theodoi', 'Cảnh báo tự động': '#/canhbao', 'Tra cứu thông tin': '#/tracuu', 'Xem lịch sử tồn kho': '#/lichsu',
  'Lịch sử nhập kho': '#/lichsu/nhap', 'Lịch sử xuất kho': '#/lichsu/xuat', 'Nhà cung cấp': '#/donhang', 'Đơn đặt hàng': '#/donhang',
  'Thêm NCC': '#/ncc/them', 'Sửa NCC': '#/ncc/sua', 'Xóa NCC': '#/ncc/xoa', 'Báo cáo': '#/baocao', 'Báo cáo nhập kho': '#/baocao/nhap',
  'Báo cáo xuất kho': '#/baocao/xuat', 'Báo cáo hàng tồn kho': '#/baocao/ton', 'Lịch sử chỉnh sửa': '#/baocao/nhatky', 'Tài khoản': '#/taikhoan'
};
function linkCrumb(html, role) {
  const parts = html.split(' › '); let bold = false;
  return parts.map((t, i) => {
    const open = t.includes('<b>'), close = t.includes('</b>'), txt = t.replace(/<\/?b>/g, '');
    if (open) bold = true; const isBold = bold; if (close) bold = false;
    let href = null;
    if (i < parts.length - 1) {
      const name = txt.trim();
      href = name === 'Tồn kho' ? (role === 'QuanLy' ? '#/quanlytonkho' : '#/tracuu') : /^DH-\d+$/.test(name) ? '#/donhang/' + name : CRUMB_LINK[name];
    }
    const out = href ? `<a href="${href}">${txt}</a>` : txt;
    return isBold ? `<b>${out}</b>` : out;
  }).join(' › ');
}
function shell(crumb, html) {
  const h = location.hash.split('?')[0], me = S.me, ql = me.role === 'QuanLy';
  const hh = /^#\/(kiemtra|theodoi|canhbao)(\/|$)/.test(h) ? '#/quanlytonkho' : h; // các màn con của Quản lý tồn kho
  const isAct = href => href && (hh === href || hh.startsWith(href + '/'));
  const nav = menuFor(me.role).map(([t, href, ic, kids]) => {
    if (!kids) return `<a href="${href}" class="${isAct(href) ? 'active' : ''}">${I(ic)}${t}</a>`;
    const open = kids.some(k => isAct(k[1]));
    return `<a class="${open ? 'open' : ''}" data-toggle>${I(ic)}${t}<span class="chev">${I('chev')}</span></a>
      <div class="sub" style="${open ? '' : 'display:none'}">${kids.map(k => `<a href="${k[1]}" class="${isAct(k[1]) ? 'active' : ''}">${k[0]}</a>`).join('')}</div>`;
  }).join('');
  const ini = me.hoTen.split(' ').filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase();
  $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><div class="mini"><img src="/logo.png" alt="" style="width:46px"></div><b>Quản lý kho</b></div><nav class="nav">${nav}</nav></aside>
  <div class="main"><div class="top"><div class="crumb">${linkCrumb(crumb, me.role)}</div><div class="sp"></div>
    ${ql ? `<span class="bell" onclick="location.hash='#/canhbao'" title="Cảnh báo tồn kho">${I('bell')}${me.canhBao ? `<i>${me.canhBao}</i>` : ''}</span>` : ''}
    <div class="user" id="userchip"><span class="dot"></span><span class="av ${ql ? 'ql' : ''}">${esc(ini)}</span><span><b>${esc(me.hoTen)}</b><small>${ql ? 'Quản lý' : 'Nhân viên'}</small></span></div>
  </div><div class="page">${html}</div></div></div>`;
  $$('[data-toggle]').forEach(a => a.onclick = () => { a.classList.toggle('open'); const s = a.nextElementSibling; s.style.display = s.style.display ? '' : 'none'; });
  $('#userchip').onclick = e => {
    e.stopPropagation(); if ($('.menu')) return $('.menu').remove();
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = `<div style="padding:10px"><b>${esc(me.hoTen)}</b><div class="muted">${ql ? 'Quản lý' : 'Nhân viên'} · ${esc(me.soDienThoai)}</div></div><hr style="border:0;border-top:1px solid #E3E7EE">
      <a id="mInfo">Thông tin cá nhân</a><a id="mPass">Đổi mật khẩu</a><a id="mOut" class="red">Đăng xuất</a>`;
    $('#userchip').appendChild(m);
    $('#mInfo').onclick = () => notice('info', me.hoTen, `${ql ? 'Quản lý' : 'Nhân viên'} · ${me.soDienThoai}`);
    $('#mOut').onclick = async () => { await api('POST', '/api/logout'); S.me = null; location.hash = '#/login'; };
    $('#mPass').onclick = () => {
      const d = modal(`<button class="x" data-close>✕</button><h3>Đổi mật khẩu</h3><p class="muted">Mật khẩu mới tối thiểu 6 ký tự.</p><div id="pe"></div>
        <div class="field"><label class="f">Mật khẩu hiện tại <i>*</i></label><input id="p0" type="password" class="inp"></div>
        <div class="field"><label class="f">Mật khẩu mới <i>*</i></label><input id="p1" type="password" class="inp"></div>
        <div class="field"><label class="f">Nhập lại mật khẩu mới <i>*</i></label><input id="p2" type="password" class="inp"></div>
        <div class="acts"><button class="btn o" data-close>Hủy</button><button class="btn" id="pok">Lưu mật khẩu</button></div>`);
      $('#pok', d.el).onclick = async () => {
        const [a, b, c] = ['#p0', '#p1', '#p2'].map(x => $(x, d.el).value);
        const loi = !a || !b || !c ? 'Không được để trống!' : b.length < 6 ? 'Mật khẩu mới phải có ít nhất 6 ký tự' : b !== c ? 'Mật khẩu nhập lại không khớp' : '';
        if (loi) return $('#pe', d.el).innerHTML = `<div class="alert red">! ${loi}</div>`;
        try { await api('POST', '/api/doimatkhau', { matKhauCu: a, matKhauMoi: b }); d.close(); toast('Đổi mật khẩu thành công'); }
        catch (e) { $('#pe', d.el).innerHTML = `<div class="alert red">! ${esc(e.error || 'Có lỗi xảy ra')}</div>`; }
      };
    };
    document.addEventListener('click', () => m.remove(), { once: true });
  };
  return $('.page');
}
const crumb = (...p) => ['Kho', ...p].map((x, i, a) => i === a.length - 1 ? `<b>${esc(x)}</b>` : esc(x)).join(' › ');

/* ---------- UC 1: Đăng nhập ---------- */
function pageLogin() {
  $('#app').innerHTML = `<div class="login"><div class="left"><div class="logo"><img src="/logo.png" alt="WinKids" style="width:150px"></div><h1>Hệ thống quản lý kho</h1><p>Quản lý nhập, xuất và tồn kho nhanh chóng, chính xác</p></div>
  <div class="right"><div class="card" style="padding:30px"><h2 class="title">Đăng nhập</h2><p class="sub-t">Vui lòng nhập tài khoản được cấp để vào hệ thống.</p>
    <div id="lerr"></div>
    <div class="field"><label class="f">Tên đăng nhập (số điện thoại) <i>*</i></label><input id="lu" class="inp" placeholder="Nhập tên đăng nhập"><div class="ferr" id="eu"></div></div>
    <div class="field"><label class="f">Mật khẩu <i>*</i></label><input id="lp" type="password" class="inp" placeholder="Nhập mật khẩu"><div class="ferr" id="ep"></div></div>
    <button class="btn" style="width:100%;margin-top:12px" id="lb">Đăng nhập</button>
    <p class="muted" style="font-size:12px;margin-top:16px">Quên mật khẩu? Vui lòng liên hệ quản lý kho.</p></div></div></div>`;
  const go = async () => {
    const u = $('#lu').value.trim(), p = $('#lp').value; $('#lerr').innerHTML = '';
    $('#eu').textContent = u ? '' : 'Không được để trống!'; $('#ep').textContent = p ? '' : 'Không được để trống!';
    $('#lu').classList.toggle('err', !u); $('#lp').classList.toggle('err', !p);
    if (!u || !p) return;
    try { await api('POST', '/api/login', { soDienThoai: u, matKhau: p }); S.me = await api('GET', '/api/me'); location.hash = '#/tongquan'; }
    catch (e) { $('#lerr').innerHTML = `<div class="alert red">! ${esc(e.error || 'Đăng nhập không thành công!')}</div>`; }
  };
  $('#lb').onclick = go; $('#lp').onkeydown = e => { if (e.key === 'Enter') go(); };
}

/* ---------- Tổng quan ---------- */
async function pageTongQuan() {
  const d = await api('GET', '/api/tongquan'), ql = S.me.role === 'QuanLy';
  shell(crumb('Tổng quan'), `<h2 class="title">Tổng quan kho</h2><br>
  <div class="stats"><div class="stat"><span>Tổng mặt hàng</span><b>${d.tongMatHang}</b></div>
    <div class="stat"><span>${ql ? 'Phiếu nhập chờ xác nhận' : 'Đơn chờ nhập'}</span><b>${ql ? d.phieuNhapChoXacNhan : d.donChoNhap}</b></div>
    <div class="stat"><span>Phiếu xuất hôm nay</span><b>${d.phieuXuatHomNay}</b></div>
    <div class="stat"><span>${ql ? 'Hàng dưới mức tối thiểu' : 'Hàng sắp hết'}</span><b class="warn">${d.duoiMuc}</b></div></div>
  <div class="card"><h3>Phiếu gần đây</h3>${table([['Mã phiếu', r => esc(r.ma)], ['Loại', r => r.loai], ['Ngày', r => fd(r.ngay)], ['Người lập', r => esc(r.nguoiLap)], ['Trạng thái', r => badge(r.trangThai)]], d.phieuGanDay)}</div>`);
}

/* ---------- UC 2: Tra cứu, lọc ---------- */
async function pageTraCuu() {
  const [dm, kho] = await Promise.all([api('GET', '/api/danhmuc'), api('GET', '/api/kho')]);
  const pg = shell(crumb('Tồn kho', 'Tra cứu thông tin'), `<div class="row"><h2 class="title grow">Tra cứu nguyên vật liệu</h2><span class="muted">● Cập nhật theo thời gian thực</span></div><br>
  <div class="row"><input id="q" class="inp grow" placeholder="Nhập tên nguyên vật liệu cần tìm" list="dl"><datalist id="dl"></datalist><button class="btn" id="go">Tìm kiếm</button></div><div class="ferr" id="qerr"></div><br>
  <div class="row"><div><label class="f">Danh mục</label><select id="dm" class="inp"><option value="">Tất cả danh mục</option>${dm.map(d => `<option value="${d.maDanhMuc}">${esc(d.tenDanhMuc)}</option>`).join('')}</select></div>
    <div><label class="f">Kho</label><select id="kho" class="inp"><option value="">Tất cả kho</option>${kho.map(k => `<option value="${k.maKho}">${esc(k.tenKho)}</option>`).join('')}</select></div>
    <button class="btn link" id="clr" style="margin-top:20px">Xóa bộ lọc</button></div><br>
  <div class="card" id="res"></div>`);
  const all = await api('GET', '/api/nguyenlieu'); $('#dl').innerHTML = all.map(n => `<option value="${esc(n.tenNguyenLieu)}">`).join('');
  const load = async () => {
    const q = $('#q').value.trim(), p = new URLSearchParams({ q, dm: $('#dm').value, kho: $('#kho').value });
    const rows = await api('GET', '/api/nguyenlieu?' + p);
    $('#qerr').textContent = q && !rows.length ? 'Không tìm thấy nguyên liệu phù hợp' : '';
    const filtered = q || $('#dm').value || $('#kho').value;
    $('#res').innerHTML = `<div class="row"><h3 class="grow">${filtered ? 'Kết quả tìm kiếm' : 'Danh sách nguyên vật liệu'}</h3>${filtered ? `<span class="muted">Tìm thấy ${rows.length} nguyên liệu</span>` : ''}</div>` +
      table([['Tên nguyên liệu', r => `<b>${esc(r.tenNguyenLieu)}</b>`], ['Danh mục', r => esc(r.tenDanhMuc)], ['Kho', r => esc(r.tenKho)], ['Số lượng', r => `<b>${r.soLuongTon} ${esc(r.donViTinh)}</b>`]],
        rows, $('#dm').value || $('#kho').value ? 'Không có nguyên liệu trong danh mục/kho đã chọn' : 'Không tìm thấy nguyên liệu phù hợp');
  };
  $('#go').onclick = load; $('#q').onkeydown = e => { if (e.key === 'Enter') load(); }; $('#dm').onchange = load; $('#kho').onchange = load;
  $('#clr').onclick = () => { $('#q').value = ''; $('#dm').value = ''; $('#kho').value = ''; load(); };
  load();
}

/* ---------- UC 3: Kiểm tra hàng nhập ---------- */
async function pageNhapKho() {
  const rows = await api('GET', '/api/donhang?trangThai=DaDatHang');
  shell(crumb('Nhập kho', 'Kiểm tra hàng nhập'), `<h2 class="title">Kiểm tra hàng nhập</h2><p class="sub-t">Chọn đơn đặt hàng đã giao tới để kiểm tra và lập phiếu nhập.</p>
  <div class="card"><h3>Danh sách đơn chờ nhập</h3>${table([['Mã đơn', r => `<b>${r.maDonHang}</b>`], ['Nhà cung cấp', r => esc(r.tenNCC)], ['Ngày đặt', r => fd(r.ngayDat)], ['Số mặt hàng', r => r.soMatHang],
    ['', r => `<button class="btn sm" onclick="location.hash='#/nhapkho/${r.maDonHang}'">Kiểm tra hàng</button>`]], rows, 'Không có đơn đặt hàng nào đang chờ nhập')}</div>`);
}
async function pageNhapForm(maDon) {
  const d = await api('GET', '/api/donhang/' + maDon);
  const st = { saiLech: {}, hoaDon: null };
  shell(crumb('Nhập kho', 'Kiểm tra hàng nhập', maDon), `<h2 class="title">Nhập số lượng thực nhận · ${d.maDonHang}</h2><p class="sub-t">Nhà cung cấp: <b>${esc(d.tenNCC)}</b> · Ngày đặt ${fd(d.ngayDat)}</p>
  <div id="ferr"></div>
  <div class="card"><h3>Nguyên vật liệu trong đơn</h3><table><thead><tr><th>Nguyên vật liệu</th><th>SL đặt</th><th>SL thực nhận</th><th>Số lô</th><th>Ngày sản xuất</th><th>Hạn sử dụng</th><th>Kết quả</th></tr></thead><tbody>
  ${d.chiTiet.map(c => `<tr data-nl="${c.maNguyenLieu}" data-dat="${c.soLuongDat}"><td><b>${esc(c.tenNguyenLieu)}</b></td><td>${c.soLuongDat} ${esc(c.donViTinh)}</td>
    <td><input class="inp sl" type="number" min="0" style="width:100px" placeholder="Nhập SL"></td><td><input class="inp lo" style="width:110px" placeholder="VD: L2311"></td>
    <td><input class="inp nsx" type="date" max="${todayISO()}"></td><td><input class="inp hsd" type="date"></td><td class="kq muted">–</td></tr>`).join('')}
  </tbody></table></div>
  <div class="card"><h3>Hóa đơn của nhà cung cấp</h3><p class="muted">Chụp hoặc chọn ảnh hóa đơn giấy (JPG, PNG) để đối chiếu. Ảnh lớn sẽ được tự động thu nhỏ.</p>
    <input type="file" id="hd" accept="image/png,image/jpeg" capture="environment"><div class="thumbs" id="hdv" style="margin-top:10px"></div></div>
  <div class="row end"><button class="btn o" onclick="history.back()">Hủy</button><button class="btn" id="save">Tạo phiếu nhập</button></div>`);
  const upd = tr => {
    const v = $('.sl', tr).value, dat = +tr.dataset.dat, kq = $('.kq', tr), nl = tr.dataset.nl;
    if (v === '') { kq.innerHTML = '–'; return; }
    if (+v === dat && !st.saiLech[nl]) kq.innerHTML = badge('Du');
    else kq.innerHTML = `${st.saiLech[nl] ? '<span class="badge b-amber">Đã ghi nhận sai lệch</span>' : `<span class="badge b-red">Lệch ${dat - v}</span>`} <button class="btn sm o" data-sl>Ghi nhận sai lệch</button>`;
    const b = $('[data-sl]', kq); if (b) b.onclick = () => ghiNhanSaiLech(tr, d, st, () => upd(tr));
  };
  $$('tbody tr[data-nl]').forEach(tr => { $('.sl', tr).oninput = () => upd(tr); });
  $('#hd').onchange = async e => { try { st.hoaDon = await fileToDataUrl(e.target.files[0]); $('#hdv').innerHTML = `<img src="${st.hoaDon}">`; } catch (m) { e.target.value = ''; notice('err', 'Không thể tải ảnh', m); } };
  $('#save').onclick = async () => {
    const chiTiet = $$('tbody tr[data-nl]').map(tr => ({ maNguyenLieu: tr.dataset.nl, soLuongThucNhan: $('.sl', tr).value, soLo: $('.lo', tr).value.trim(), ngaySanXuat: $('.nsx', tr).value, hanSuDung: $('.hsd', tr).value }));
    const lech = $$('tbody tr[data-nl]').filter(tr => $('.sl', tr).value !== '' && +$('.sl', tr).value !== +tr.dataset.dat && !st.saiLech[tr.dataset.nl]);
    if (lech.length) return $('#ferr').innerHTML = '<div class="alert red">! Có mặt hàng bị lệch số lượng chưa ghi nhận sai lệch.</div>';
    try {
      const r = await api('POST', '/api/phieunhap', { maDonHang: maDon, chiTiet, hinhAnhHoaDon: st.hoaDon, saiLech: Object.values(st.saiLech) });
      notice('ok', 'Tạo phiếu nhập thành công', `Phiếu ${r.maPhieuNhap} đã được gửi cho quản lý xác nhận.`); location.hash = '#/nhapkho';
    } catch (e) { $('#ferr').innerHTML = `<div class="alert red">! ${esc(e.error)}</div>`; scrollTo(0, 0); }
  };
}
function ghiNhanSaiLech(tr, d, st, done) {
  const nl = tr.dataset.nl, c = d.chiTiet.find(x => x.maNguyenLieu === nl), lech = Math.max(1, Math.abs(+tr.dataset.dat - +$('.sl', tr).value)), anh = [];
  const m = modal(`<button class="x" data-close>✕</button><h3>Ghi nhận sai lệch hàng nhập</h3><p class="muted">${esc(c.tenNguyenLieu)} · Đặt ${c.soLuongDat} ${esc(c.donViTinh)}</p><div id="serr"></div>
    <label class="f">Lý do <i>*</i></label>
    ${[['GiaoThieu', 'Giao thiếu'], ['GiaoSaiMatHang', 'Giao sai mặt hàng'], ['HuHong', 'Hàng hư hỏng'], ['CanHanHetHan', 'Cận hạn / hết hạn']].map(([v, t]) => `<label class="opt"><input type="radio" name="ld" value="${v}"><span>${t}</span></label>`).join('')}
    <div class="field"><label class="f">Số lượng sai lệch <i>*</i></label><input id="ssl" class="inp" type="number" min="1" value="${lech}"></div>
    <label class="f">Ảnh minh chứng <i>*</i></label><input type="file" id="sanh" accept="image/png,image/jpeg" capture="environment" multiple><div class="thumbs" id="sthumb" style="margin-top:8px"></div>
    <div class="acts"><button class="btn o" data-close>Hủy</button><button class="btn" id="sok">Lưu ghi nhận</button></div>`);
  $('#sanh').onchange = async e => {
    for (const f of e.target.files) { try { anh.push(await fileToDataUrl(f)); } catch (x) { $('#serr').innerHTML = `<div class="alert red">! ${esc(x)}</div>`; } }
    $('#sthumb').innerHTML = anh.map(a => `<img src="${a}">`).join('');
  };
  $('#sok').onclick = () => {
    const ld = $('input[name=ld]:checked', m.el), sl = +$('#ssl').value;
    if (!ld || !(sl > 0)) return $('#serr').innerHTML = '<div class="alert red">! Vui lòng chọn lý do và nhập số lượng sai lệch</div>';
    if (!anh.length) return $('#serr').innerHTML = '<div class="alert red">! Chưa có ảnh minh chứng</div>';
    st.saiLech[nl] = { maNguyenLieu: nl, lyDo: ld.value, soLuongSaiLech: sl, anh }; m.close(); toast('Ghi nhận sai lệch thành công'); done();
  };
}

/* ---------- UC 4: Xuất kho ---------- */
async function pageXuatKho() {
  const rows = await api('GET', '/api/phieuxuat');
  shell(crumb('Xuất kho'), `<div class="row"><h2 class="title grow">Xuất kho</h2><button class="btn" onclick="location.hash='#/xuatkho/tao'">+ Tạo phiếu xuất kho</button></div><br>
  <div class="card"><h3>Danh sách phiếu xuất kho</h3>${table([['Mã phiếu', r => `<b>${r.maPhieuXuat}</b>`], ['Ngày tạo', r => fd(r.ngayXuat)], ['Người lập', r => esc(r.nguoiLap)], ['Lý do xuất', r => esc(r.lyDoXuat)], ['Số mặt hàng', r => r.soMatHang], ['Trạng thái', r => badge(r.trangThai)]], rows, 'Chưa có phiếu xuất')}</div>`);
}
async function pageXuatForm() {
  const nls = await api('GET', '/api/nguyenlieu'); const items = [];
  shell(crumb('Xuất kho', 'Tạo phiếu xuất kho'), `<h2 class="title">Tạo phiếu xuất kho</h2><br><div id="ferr"></div>
  <div class="card"><h3>Thông tin phiếu</h3><div class="grid3"><div><label class="f">Ngày tạo</label><input class="inp" readonly value="${fd(todayISO())}"></div>
    <div><label class="f">Người lập</label><input class="inp" readonly value="${esc(S.me.hoTen)}"></div>
    <div><label class="f">Lý do xuất <i>*</i></label><select id="ld" class="inp"><option value="">Chọn lý do xuất</option><option>Ca bán hàng</option><option>Xuất hủy (hết hạn / hư hỏng)</option><option>Dùng nội bộ / mẫu thử</option></select></div></div></div>
  <div class="card"><h3>Nguyên liệu cần xuất</h3><div class="row" style="align-items:flex-start">
    <div class="grow"><label class="f">Tìm kiếm nguyên liệu</label><input id="tim" class="inp" list="dl" placeholder="Nhập tên nguyên liệu"><datalist id="dl">${nls.map(n => `<option value="${esc(n.tenNguyenLieu)}">Tồn: ${n.soLuongTon} ${esc(n.donViTinh)}</option>`).join('')}</datalist><div class="ferr" id="e1"></div></div>
    <div style="width:180px"><label class="f">Số lượng</label><input id="sl" class="inp" type="number" min="1" placeholder="Nhập số lượng"><div class="ferr" id="e2"></div></div>
    <button class="btn o" id="them" style="margin-top:20px">+ Thêm nguyên liệu</button></div></div>
  <div class="card" id="bang"></div>
  <div class="row end"><button class="btn o" onclick="location.hash='#/xuatkho'">Hủy</button><button class="btn" id="ok">Xác nhận</button></div>`);
  const draw = () => $('#bang').innerHTML = table([['STT', (r) => items.indexOf(r) + 1], ['Tên nguyên liệu', r => esc(r.ten)], ['Đơn vị', r => esc(r.dvt)], ['Số lượng xuất', r => r.soLuong], ['', r => `<button class="btn sm o red" data-rm="${r.maNguyenLieu}">Bỏ</button>`]], items, 'Chưa có nguyên liệu nào trong phiếu');
  $('#bang').onclick = e => { const m = e.target.dataset.rm; if (m) { items.splice(items.findIndex(i => i.maNguyenLieu === m), 1); draw(); } };
  draw();
  $('#them').onclick = () => {
    const ten = $('#tim').value.trim(), sl = $('#sl').value; $('#e1').textContent = $('#e2').textContent = '';
    if (!ten) return $('#e1').textContent = 'Không được để trống!';
    const n = nls.find(x => x.tenNguyenLieu.toLowerCase() === ten.toLowerCase()); if (!n) return $('#e1').textContent = 'Tên nguyên liệu không tồn tại, vui lòng kiểm tra lại!';
    if (sl === '') return $('#e2').textContent = 'Không được để trống!';
    if (!(+sl > 0) || !Number.isInteger(+sl)) return $('#e2').textContent = 'Số lượng xuất phải lớn hơn 0!';
    const ex = items.find(i => i.maNguyenLieu === n.maNguyenLieu); if (ex) ex.soLuong += +sl; else items.push({ maNguyenLieu: n.maNguyenLieu, ten: n.tenNguyenLieu, dvt: n.donViTinh, soLuong: +sl });
    $('#tim').value = $('#sl').value = ''; draw(); toast('Đã thêm nguyên liệu thành công!');
  };
  const gui = async phuongAn => {
    try {
      const r = await api('POST', '/api/phieuxuat', { lyDoXuat: $('#ld').value, chiTiet: items.map(i => ({ maNguyenLieu: i.maNguyenLieu, soLuong: i.soLuong })), phuongAn });
      if (r.choBoSung) notice('warn', 'Đã ghi nhận chờ bổ sung hàng', `Phiếu ${r.maPhieuXuat} chưa được xuất kho.`);
      else notice('ok', 'Tạo phiếu xuất kho thành công!', `Phiếu ${r.maPhieuXuat} đã được lưu, chờ quản lý xác nhận.`);
      location.hash = '#/xuatkho';
    } catch (e) {
      if (e.status === 409 && e.thieu) return thieuHang(e.thieu, gui);
      $('#ferr').innerHTML = `<div class="alert red">! ${esc(e.error)}</div>`;
    }
  };
  $('#ok').onclick = () => gui();
}
function thieuHang(thieu, gui) {
  let pa = null;
  const m = modal(`<h3 style="color:#B3261E">! Thiếu hàng trong kho</h3><p class="muted">Tồn kho hiện tại không đủ cho phiếu xuất. Vui lòng chọn phương án xử lý.</p>
    ${table([['Nguyên liệu', r => esc(r.tenNguyenLieu)], ['Yêu cầu', r => r.yeuCau + ' ' + esc(r.donViTinh)], ['Tồn kho', r => r.ton + ' ' + esc(r.donViTinh)], ['Tình trạng', r => `<span class="badge b-red">Thiếu ${r.yeuCau - r.ton} ${esc(r.donViTinh)}</span>`]], thieu)}
    <br><b>Phương án xử lý</b><br><br>
    <div class="opt" data-pa="LayConLai"><input type="radio" name="pa"><span><b>Lấy số lượng còn lại</b><small>Chỉ xuất phần còn trong kho.</small></span></div>
    <div class="opt" data-pa="ChoBoSung"><input type="radio" name="pa"><span><b>Không lấy số lượng còn lại</b><small>Chưa xuất kho, phiếu được ghi nhận chờ bổ sung hàng.</small></span></div>
    <div class="acts"><button class="btn o" data-close>Quay lại</button><button class="btn" id="paok" disabled>Xác nhận phương án xử lý</button></div>`, 'wide');
  $$('.opt', m.el).forEach(o => o.onclick = () => { $$('.opt', m.el).forEach(x => x.classList.remove('on')); o.classList.add('on'); $('input', o).checked = true; pa = o.dataset.pa; $('#paok').disabled = false; });
  $('#paok').onclick = () => {
    if (pa === 'ChoBoSung') { m.close(); return gui(pa); }
    m.close();
    const c = modal(`<h3>Xác nhận số lượng thực tế sẽ xuất</h3><p class="muted">Hệ thống chỉ xuất theo số lượng tồn kho hiện có.</p>
      ${table([['Nguyên liệu', r => esc(r.tenNguyenLieu)], ['Yêu cầu', r => r.yeuCau], ['Tồn kho', r => r.ton], ['Thực xuất', r => `<b>${r.ton} ${esc(r.donViTinh)}</b>`]], thieu)}
      <label class="opt" style="margin-top:14px"><input type="checkbox" id="cf"><span>Tôi xác nhận số lượng thực tế sẽ xuất ở trên</span></label>
      <div class="acts"><button class="btn o" data-close>Quay lại</button><button class="btn" id="cfok" disabled>Xác nhận số lượng</button></div>`, 'wide');
    $('#cf').onchange = e => $('#cfok').disabled = !e.target.checked;
    $('#cfok').onclick = () => { c.close(); gui('LayConLai'); };
  };
}

/* ---------- UC 5: Lịch sử tồn kho (bám Figma) ---------- */
const LS_IC = {
  in: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
  out: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M7 14l5-5 5 5M4 3h16"/></svg>',
  next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  clip: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h.01M12 10h4M9 14h.01M12 14h4M9 18h.01M12 18h4"/></svg>'
};
async function pageLichSu(loai) {
  const lsCrumb = (...p) => `Kho › <b>${p.map(esc).join(' › ')}</b>`;
  // Màn chọn: Lịch sử tồn kho
  if (loai !== 'nhap' && loai !== 'xuat') {
    const opt = (k, ic, t, s) => `<a class="ls-opt" href="#/lichsu/${k}"><span class="ls-ic">${ic}</span><span class="grow"><b>${t}</b><small>${s}</small></span><span class="ls-next">${LS_IC.next}</span></a>`;
    return shell(lsCrumb('Xem lịch sử tồn kho'), `<h2 class="title ls-title">Lịch sử tồn kho</h2>
    <div class="card ls-card"><h3>Chọn lịch sử cần xem</h3><p class="muted ls-sub">Xem lại các lần nhập, xuất kho đã thực hiện để đối chiếu và tra cứu.</p>
    <div class="ls-opts">${opt('nhap', LS_IC.in, 'Lịch sử nhập kho', 'Danh sách phiếu nhập kho')}${opt('xuat', LS_IC.out, 'Lịch sử xuất kho', 'Danh sách phiếu xuất kho')}</div></div>`);
  }
  // Màn danh sách: Lịch sử nhập kho / Lịch sử xuất kho
  const nhap = loai === 'nhap', ten = nhap ? 'nhập' : 'xuất';
  const rows = await api('GET', '/api/lichsu/' + loai);
  const groups = new Map();
  rows.forEach(r => { if (!groups.has(r.maPhieu)) groups.set(r.maPhieu, []); groups.get(r.maPhieu).push(r); });
  const body = [...groups.values()].map(g => g.map((r, i) => `<tr class="${i === g.length - 1 ? 'ls-end' : ''}">${i === 0
    ? `<td rowspan="${g.length}"><b>${esc(r.maPhieu)}</b></td><td rowspan="${g.length}">${fd(r.ngay)}</td>` : ''}<td>${esc(r.tenNguyenLieu)}</td><td>${r.soLuong} ${esc(r.donViTinh)}</td></tr>`).join('')).join('');
  shell(lsCrumb('Xem lịch sử tồn kho', `Lịch sử ${ten} kho`), `<h2 class="title ls-title">Lịch sử ${ten} kho</h2>
  <div class="ls-tabs"><a class="tab ${nhap ? 'on' : ''}" href="#/lichsu/nhap">Lịch sử nhập kho</a><a class="tab ${nhap ? '' : 'on'}" href="#/lichsu/xuat">Lịch sử xuất kho</a></div>
  <div class="card ls-card"><div class="ls-head"><h3>Danh sách phiếu ${ten} kho</h3><span class="muted">${groups.size} phiếu</span></div>
  ${nhap ? '' : `<div class="ls-info">${LS_IC.info}Chỉ hiển thị phiếu xuất đã được quản lý xác nhận.</div>`}
  <div class="ls-box"><table class="ls-table"><colgroup><col style="width:18.7%"><col style="width:21.8%"><col style="width:39.4%"><col></colgroup>
  <thead><tr><th>Mã phiếu</th><th>Ngày ${ten}</th><th>Nguyên vật liệu</th><th>Số lượng</th></tr></thead>
  <tbody>${body || `<tr><td colspan="4"><div class="ls-empty"><span>${LS_IC.clip}</span><b>Chưa có lịch sử ${ten} kho</b></div></td></tr>`}</tbody></table></div></div>`);
}

/* ---------- UC 6: Quản lý tồn kho (Quản lý) – bám Figma ---------- */
const tkCrumb = (...p) => `Kho › Tồn kho › <b>${['Quản lý tồn kho', ...p].map(esc).join(' › ')}</b>`;
const backBtn = href => `<button class="btn o tk-back" onclick="location.hash='${href}'">Quay lại</button>`;
const nowVN = (sec) => { const d = new Date(), z = n => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} · ${z(d.getHours())}:${z(d.getMinutes())}${sec ? ':' + z(d.getSeconds()) : ''}`; };
const tkTable = (cols, rows, empty, rowCls = () => '') => `<div class="tk-box"><table class="tk-table"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.length
  ? rows.map(r => `<tr class="${rowCls(r)}">${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')
  : `<tr><td colspan="${cols.length}" class="tk-empty">${esc(empty)}</td></tr>`}</tbody></table></div>`;
const dv = (n, u) => `${n} ${esc(u || '')}`;

async function pageQuanLyTonKho() {
  const d = await api('GET', '/api/quanlytonkho');
  const row = (t, s, href) => `<div class="tk-row"><div class="grow"><b>${t}</b><p>${s}</p></div><button class="btn o" onclick="location.hash='${href}'">Xem chi tiết</button></div>`;
  shell(tkCrumb(), `<h2 class="title tk-title">Quản lý hàng tồn kho</h2>
  <div class="tk-stats"><div class="stat"><span>Phiếu nhập chờ kiểm tra</span><b>${d.nhapCho}</b></div><div class="stat"><span>Phiếu xuất chờ xác nhận</span><b>${d.xuatCho}</b></div>
    <div class="stat"><span>Hàng dưới mức tối thiểu</span><b class="${d.duoiMuc.length ? 'warn' : ''}">${d.duoiMuc.length}</b></div></div>
  <div class="card"><div class="tk-head"><h3>Quản lý tồn kho</h3><span class="muted">${nowVN().slice(0, 10)}</span></div>
    ${row('Kiểm tra phiếu nhập', 'Tra cứu, kiểm tra chứng từ và xác nhận phiếu nhập kho.', '#/kiemtra/nhap')}
    ${row('Kiểm tra phiếu xuất', 'Kiểm tra danh sách mặt hàng và xác nhận phiếu xuất kho.', '#/kiemtra/xuat')}
    ${row('Theo dõi tồn kho và cảnh báo', 'Theo dõi tồn kho theo thời gian thực và nguyên vật liệu sắp hết.', '#/theodoi')}</div>
  <div class="card"><div class="tk-head"><h3>Cảnh báo tồn kho</h3><span class="muted">${d.pxGanNhat ? 'Sau giao dịch ' + esc(d.pxGanNhat) : ''}</span></div>
    ${tkTable([['Nguyên vật liệu', r => esc(r.tenNguyenLieu)], ['Số lượng còn lại', r => dv(r.soLuongTon, r.donViTinh)], ['Mức tối thiểu', r => dv(r.mucToiThieu, r.donViTinh)],
      ['Trạng thái', () => '<span class="badge b-amber">Dưới mức tối thiểu</span>']], d.duoiMuc, 'Không có nguyên vật liệu dưới mức tối thiểu')}</div>`);
}

/* 6.1 / 6.2 – danh sách phiếu chờ kiểm tra */
async function pageKiemTra(loai, id) {
  if (id) return chiTietPhieu(loai, id);
  const nhap = loai === 'nhap', ten = nhap ? 'phiếu nhập' : 'phiếu xuất', pre = nhap ? 'PN-' : 'PX-';
  const all = await api('GET', `/api/kiemtra/${loai}?q=`);
  const ma = r => nhap ? r.maPhieuNhap : r.maPhieuXuat;
  const tts = nhap ? [['', 'Tất cả trạng thái'], ['ChoXacNhan', 'Chờ xác nhận'], ['ChoXuLy', 'Chờ xử lý']] : [['', 'Tất cả trạng thái'], ['ChoXacNhan', 'Chờ xác nhận']];
  shell(tkCrumb('Kiểm tra ' + ten), `<div class="tk-top"><h2 class="title tk-title">Kiểm tra ${ten}</h2>${backBtn('#/quanlytonkho')}</div>
  <div class="card tk-filter"><h3>Tra cứu ${ten}</h3><div class="tk-frow">
    <div class="tk-combo"><label class="f">Mã phiếu</label><input id="q" class="inp" value="${pre}" autocomplete="off"><span class="tk-chev">${I('chev')}</span><div class="tk-dd" id="dd" hidden></div></div>
    <div class="tk-sel"><label class="f">Trạng thái</label><select id="tt" class="inp">${tts.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select></div>
    <button class="btn" id="go">Tìm kiếm</button></div></div>
  <div class="card" id="res"></div>`);
  const q = $('#q'), dd = $('#dd');
  const showDD = () => {
    const k = q.value.trim().toUpperCase(), list = all.map(ma).filter(m => m.toUpperCase().includes(k));
    dd.innerHTML = list.length ? list.map((m, i) => `<div class="${i ? '' : 'on'}" data-m="${esc(m)}">${esc(m)}</div>`).join('') : '<p>Không có mã phiếu phù hợp</p>';
    dd.hidden = false; q.closest('.tk-combo').classList.add('open');
    $$('[data-m]', dd).forEach(o => o.onmousedown = e => { e.preventDefault(); q.value = o.dataset.m; hideDD(); load(); });
  };
  const hideDD = () => { dd.hidden = true; q.closest('.tk-combo').classList.remove('open'); };
  q.onfocus = showDD; q.oninput = showDD; q.onblur = hideDD;
  q.onkeydown = e => { if (e.key === 'Enter') { hideDD(); load(); } };
  $('.tk-chev').onmousedown = e => { e.preventDefault(); dd.hidden ? (q.focus(), showDD()) : hideDD(); };
  const load = () => {
    const k = q.value.trim().toUpperCase(), tt = $('#tt').value;
    const rows = all.filter(r => ma(r).toUpperCase().includes(k) && (!tt || r.trangThai === tt));
    $('#res').innerHTML = `<div class="tk-head"><h3>Danh sách ${ten} chờ kiểm tra</h3><span class="muted">${rows.length} phiếu</span></div>` +
      tkTable([['Mã phiếu', r => `<b>${esc(ma(r))}</b>`], ['Loại phiếu', () => nhap ? 'Nhập kho' : 'Xuất kho'], ['Ngày lập', r => fd(nhap ? r.ngayNhap : r.ngayXuat)], ['Người lập', r => esc(r.nguoiLap)],
        ['Trạng thái', r => badge(r.trangThai)], ['Thao tác', r => `<button class="btn o sm tk-kt" onclick="location.hash='#/kiemtra/${loai}/${esc(ma(r))}'">Kiểm tra</button>`]], rows, 'Trống!');
  };
  $('#go').onclick = load; $('#tt').onchange = load; load();
}

/* Chi tiết phiếu nhập / xuất + xác nhận */
async function chiTietPhieu(loai, id, daLuu) {
  const nhap = loai === 'nhap', ten = nhap ? 'phiếu nhập' : 'phiếu xuất';
  const p = await api('GET', `/api/phieu${loai}/${encodeURIComponent(id)}`);
  const choDuyet = nhap ? ['ChoXacNhan', 'ChoXuLy'].includes(p.trangThai) : p.trangThai === 'ChoXacNhan';
  const ngay = nhap ? p.ngayNhap : p.ngayXuat;
  const sl = {}; (p.saiLech || []).forEach(s => { const o = sl[s.maNguyenLieu] || (sl[s.maNguyenLieu] = { loi: 0, thieu: 0 }); s.lyDo === 'GiaoThieu' ? o.thieu += s.soLuongSaiLech : o.loi += s.soLuongSaiLech; });
  const coSaiLech = nhap && p.saiLech.length > 0;
  const items = nhap
    ? (coSaiLech
      ? tkTable([['Nguyên vật liệu', r => esc(r.tenNguyenLieu)], ['Số lượng', r => { const o = sl[r.maNguyenLieu] || { loi: 0, thieu: 0 }; return dv(r.soLuongHoaDon ?? (r.soLuongThucNhan + o.loi + o.thieu), r.donViTinh); }],
          ['Lỗi', r => dv((sl[r.maNguyenLieu] || {}).loi || 0, r.donViTinh)], ['Thiếu', r => dv((sl[r.maNguyenLieu] || {}).thieu || 0, r.donViTinh)], ['Thực nhận (đạt)', r => dv(r.soLuongThucNhan, r.donViTinh)]], p.chiTiet, 'Không có mặt hàng')
      : tkTable([['Nguyên vật liệu', r => esc(r.tenNguyenLieu)], ['Đơn vị tính', r => esc(r.donViTinh)], ['Số lượng', r => r.soLuongThucNhan]], p.chiTiet, 'Không có mặt hàng'))
    : tkTable([['Nguyên vật liệu', r => esc(r.tenNguyenLieu)], ['Đơn vị tính', r => esc(r.donViTinh)], ['Số lượng', r => r.soLuongThucXuat]], p.chiTiet, 'Không có mặt hàng');
  const giay = p.hinhAnhHoaDon ? `<img src="${p.hinhAnhHoaDon}" alt="Chứng từ">` : `<div class="tk-paper"><small>QUẢN LÝ KHO · CHỨNG TỪ MẪU</small><h4>PHIẾU ${nhap ? 'NHẬP' : 'XUẤT'} KHO</h4><p class="c">${esc(id)} · ${fd(ngay)}</p><hr>
    <p>Người lập: ${esc(p.nguoiLap)}</p><p>${nhap ? 'Nhà cung cấp: ' + esc(p.tenNCC || '—') : 'Lý do xuất: ' + esc(p.lyDoXuat || '')}</p>
    ${p.chiTiet.map(r => `<p class="it"><span>${esc(r.tenNguyenLieu)}</span><span>${nhap ? r.soLuongThucNhan : r.soLuongThucXuat} ${esc(r.donViTinh)}</span></p>`).join('')}<hr>
    <div class="sg"><span>Người lập phiếu<br><b>${esc(p.nguoiLap)}</b></span><span>Người giao / nhận<br><b>Đã ký</b></span></div></div>`;
  const anhMC = coSaiLech ? p.saiLech.flatMap(s => s.anh) : [];
  shell(tkCrumb('Kiểm tra ' + ten, id), `<div class="tk-top"><h2 class="title tk-title">Chi tiết ${ten} ${esc(id)}</h2>${backBtn('#/kiemtra/' + loai)}</div>
  <div class="card"><div class="tk-head"><h3>Thông tin phiếu</h3><span class="muted">${esc(id)}</span></div>
    <div class="tk-info"><div><span>Loại phiếu</span><b>${nhap ? 'Nhập kho' : 'Xuất kho'}</b></div><div><span>Ngày lập</span><b>${fd(ngay)}</b></div><div><span>Người lập</span><b>${esc(p.nguoiLap)}</b></div><div><span>Trạng thái</span>${badge(p.trangThai)}</div></div></div>
  <div class="card tk-detail"><div><h3>Danh sách mặt hàng</h3>${items}
    ${choDuyet && coSaiLech ? `<div class="tk-alert amber"><i></i>Có hàng lỗi / thiếu: kiểm tra minh chứng trước khi xác nhận.</div><p class="tk-note">Quản lý tự phản hồi nhà cung cấp ngoài hệ thống, sau đó tiếp tục Xác nhận.</p>` : ''}
    ${daLuu ? `<div class="tk-alert green"><i></i>Thông tin phiếu đã cập nhật và lưu lịch sử ${nhap ? 'nhập' : 'xuất'} kho.</div>` : ''}
    ${choDuyet ? `<div class="tk-acts"><button class="btn o" onclick="location.hash='#/kiemtra/${loai}'">Quay lại</button><button class="btn" id="xn">Xác nhận</button></div>` : ''}</div>
    <div class="tk-side"><h4>Hình ảnh chứng từ đính kèm</h4><div class="tk-doc">${giay}</div>
    ${anhMC.length ? `<h4>Hình ảnh minh chứng</h4><div class="tk-mc">${anhMC.map(a => `<img src="${a}" alt="Minh chứng">`).join('')}</div>` : ''}</div></div>`);
  if (choDuyet) $('#xn').onclick = async () => {
    $('#xn').disabled = true;
    try { await api('POST', `/api/phieu${loai}/${encodeURIComponent(id)}/xacnhan`); S.me = await api('GET', '/api/me'); chiTietPhieu(loai, id, true); }
    catch (e) {
      $('#xn').disabled = false;
      notice('err', 'Có lỗi xảy ra', `Chưa cập nhật ${ten} ${id}. Phiếu vẫn chờ xác nhận, chưa lưu vào lịch sử ${nhap ? 'nhập' : 'xuất'} kho.` + (e.error && e.error !== 'Có lỗi xảy ra' ? ` (${e.error})` : ''));
    }
  };
}

/* 6.3 – Theo dõi tồn kho theo thời gian thực */
async function pageTheoDoi() {
  const ve = rows => tkTable([['Tên Nguyên Liệu', r => esc(r.tenNguyenLieu)], ['Danh mục', r => esc(r.tenDanhMuc)], ['Số lượng tồn', r => dv(r.soLuongTon, r.donViTinh)], ['Mức tối thiểu', r => dv(r.mucToiThieu, r.donViTinh)]],
    rows, 'Chưa có dữ liệu tồn kho', r => r.duoiMuc ? 'tk-low' : '');
  const rows = await api('GET', '/api/nguyenlieu');
  shell(tkCrumb('Theo dõi tồn kho'), `<div class="tk-top"><h2 class="title tk-title">Theo dõi tồn kho</h2>${backBtn('#/quanlytonkho')}</div>
  <div class="card"><div class="tk-head"><h3>Tồn kho theo thời gian thực</h3><span class="muted" id="clock">${nowVN(1)}</span></div>
    <div class="tk-live-row"><span class="tk-live">Cập nhật theo thời gian thực</span>${rows.some(r => r.duoiMuc) ? `<a class="tk-link" href="#/canhbao">Xem cảnh báo tồn kho →</a>` : ''}</div>
    <div id="bang">${ve(rows)}</div></div>`);
  let n = 0;
  const t = setInterval(async () => {
    if (location.hash.split('?')[0] !== '#/theodoi' || !$('#clock')) return clearInterval(t);
    $('#clock').textContent = nowVN(1);
    if (++n % 10 === 0) { try { const r = await api('GET', '/api/nguyenlieu'); if ($('#bang')) $('#bang').innerHTML = ve(r); } catch { } }
  }, 1000);
}

/* 6.4 – Cảnh báo tự động */
async function pageCanhBao() {
  const [d, dx] = await Promise.all([api('GET', '/api/quanlytonkho'), api('GET', '/api/dexuat')]);
  if (!d.duoiMuc.length) {
    const rows = await api('GET', '/api/nguyenlieu');
    return shell(tkCrumb('Cảnh báo tự động'), `<div class="tk-top"><h2 class="title tk-title">Cảnh báo tồn kho</h2>${backBtn('#/quanlytonkho')}</div>
    <div class="card"><div class="tk-head"><h3>Danh sách tồn kho</h3><span class="muted">${nowVN()}</span></div>
      ${tkTable([['Tên Nguyên Liệu', r => esc(r.tenNguyenLieu)], ['Danh mục', r => esc(r.tenDanhMuc)], ['Số lượng tồn', r => dv(r.soLuongTon, r.donViTinh)], ['Mức tối thiểu', r => dv(r.mucToiThieu, r.donViTinh)]], rows, 'Chưa có dữ liệu tồn kho')}</div>`);
  }
  const n = d.duoiMuc.length;
  shell(tkCrumb('Cảnh báo tự động'), `<div class="tk-top"><h2 class="title tk-title">Cảnh báo tồn kho</h2>${backBtn('#/quanlytonkho')}</div>
  <div class="tk-alert amber tk-banner"><i></i>Có ${n} nguyên vật liệu sắp hết${d.pxGanNhat ? ' sau giao dịch xuất kho ' + esc(d.pxGanNhat) : ''}.</div>
  <div class="card"><div class="tk-head"><h3>Danh sách cảnh báo</h3><span class="muted">${nowVN()}</span></div>
    ${tkTable([['Nguyên vật liệu sắp hết', r => esc(r.tenNguyenLieu)], ['Số lượng còn lại', r => dv(r.soLuongTon, r.donViTinh)], ['Ngưỡng tối thiểu', r => dv(r.mucToiThieu, r.donViTinh)],
      ['Trạng thái', r => `<span class="tk-st">${r.choXem ? 'Chờ quản lý xem' : 'Dưới mức tối thiểu'}</span>`]], d.duoiMuc, '', () => 'tk-low')}</div>
  <div class="card"><div class="tk-head"><h3>Danh sách đề xuất nhập hàng</h3></div>
    ${tkTable([['Nguyên vật liệu', r => esc(r.tenNguyenLieu)], ['Số lượng còn lại', r => dv(r.soLuongTon, r.donViTinh)], ['Đề xuất nhập', r => Math.max(r.soLuongDeXuat, 1)], ['Đơn vị tính', r => esc(r.donViTinh)]], dx, 'Không có đề xuất')}</div>`);
  if (d.duoiMuc.some(r => r.choXem)) { try { await api('POST', '/api/canhbao/daxem'); S.me = await api('GET', '/api/me'); const b = $('.bell i'); if (b && !S.me.canhBao) b.remove(); } catch { } }
}

/* ---------- UC 7: Đơn đặt hàng, nhà cung cấp ---------- */
async function pageDonHang() {
  const rows = await api('GET', '/api/donhang');
  shell(crumb('Nhà cung cấp', 'Đơn đặt hàng'), `<div class="row"><h2 class="title grow">Đơn đặt hàng</h2><button class="btn" onclick="location.hash='#/donhang/tao'">+ Tạo đơn đặt hàng</button></div><p class="sub-t">Mỗi đơn gửi cho một nhà cung cấp</p>
  <div class="card"><h3>Danh sách đơn</h3>${table([['Mã đơn', r => `<a href="#/donhang/${r.maDonHang}"><b>${r.maDonHang}</b></a>`], ['Nhà cung cấp', r => esc(r.tenNCC)], ['Ngày tạo', r => fd(r.ngayDat)], ['Số mặt hàng', r => r.soMatHang], ['Trạng thái', r => badge(r.trangThai)]], rows, 'Chưa có đơn đặt hàng')}</div>`);
}
async function pageDonForm(maSua) {
  const [nccs, nls, dx] = await Promise.all([api('GET', '/api/ncc'), api('GET', '/api/nguyenlieu'), api('GET', '/api/dexuat')]);
  const don = maSua ? await api('GET', '/api/donhang/' + maSua) : null;
  const items = don ? don.chiTiet.map(c => ({ ma: c.maNguyenLieu, sl: c.soLuongDat })) : dx.map(x => ({ ma: x.maNguyenLieu, sl: x.soLuongDeXuat }));
  shell(crumb('Nhà cung cấp', 'Đơn đặt hàng', maSua ? maSua : 'Tạo đơn đặt hàng', ...(maSua ? ['Chỉnh sửa'] : [])), `<h2 class="title">${maSua ? 'Chỉnh sửa đơn đặt hàng' : 'Tạo đơn đặt hàng'}</h2>
  <p class="sub-t">${maSua ? 'Chỉ sửa số lượng hoặc thêm, bỏ nguyên vật liệu' : 'Chọn một nhà cung cấp, sau đó chọn nguyên vật liệu và số lượng cần đặt'}</p><div id="ferr"></div>
  <div class="card"><h3>Thông tin đơn</h3><div class="grid3"><div><label class="f">Nhà cung cấp <i>*</i></label>
    <select id="ncc" class="inp" ${maSua ? 'disabled' : ''}><option value="">Chọn nhà cung cấp</option>${nccs.map(n => `<option value="${n.maNCC}" ${don && don.maNCC === n.maNCC ? 'selected' : ''}>${esc(n.tenNCC)}</option>`).join('')}</select><div class="ferr" id="enc"></div></div>
    <div><label class="f">Ngày tạo</label><input class="inp" readonly value="${don ? fd(don.ngayDat) : fd(todayISO())}"></div><div><label class="f">Người lập</label><input class="inp" readonly value="${esc(S.me.hoTen)}"></div></div>
    ${maSua ? '<p class="muted" style="font-size:12px">Không đổi nhà cung cấp khi chỉnh sửa đơn</p>' : ''}</div>
  <div class="card"><h3>Nguyên vật liệu cần đặt</h3><div id="bang"></div><br><div class="row"><select id="addnl" class="inp" style="max-width:320px"><option value="">+ Thêm nguyên vật liệu</option>${nls.map(n => `<option value="${n.maNguyenLieu}">${esc(n.tenNguyenLieu)}</option>`).join('')}</select></div></div>
  <div class="row end"><button class="btn o" onclick="history.back()">Hủy</button><button class="btn" id="ok">${maSua ? 'Cập nhật đơn hàng' : 'Kiểm tra đơn'}</button></div>`);
  const nl = ma => nls.find(n => n.maNguyenLieu === ma) || {};
  const draw = () => {
    $('#bang').innerHTML = table([['Nguyên vật liệu', r => `<b>${esc(nl(r.ma).tenNguyenLieu)}</b>`], ['Đơn vị', r => esc(nl(r.ma).donViTinh)], ['Tồn hiện tại', r => `<span class="${nl(r.ma).duoiMuc ? 'red-t' : ''}">${nl(r.ma).soLuongTon}</span>`],
      ['Đề xuất', r => Math.max(0, (nl(r.ma).mucToiDa || 5) - (nl(r.ma).soLuongTon || 0))], ['Số lượng đặt', r => `<input class="inp" type="number" min="1" style="width:100px" data-sl="${r.ma}" value="${r.sl}"><div class="ferr" data-e="${r.ma}"></div>`],
      ['', r => `<button class="btn link" style="color:#B3261E" data-rm="${r.ma}">Bỏ</button>`]], items, 'Chưa có nguyên vật liệu');
    $$('[data-sl]').forEach(i => i.oninput = () => items.find(x => x.ma === i.dataset.sl).sl = i.value);
    $$('[data-rm]').forEach(b => b.onclick = () => { items.splice(items.findIndex(x => x.ma === b.dataset.rm), 1); draw(); });
  };
  $('#addnl').onchange = e => { const v = e.target.value; if (v && !items.find(x => x.ma === v)) items.push({ ma: v, sl: 1 }); e.target.value = ''; draw(); };
  draw();
  $('#ok').onclick = async () => {
    $('#enc').textContent = ''; $('#ferr').innerHTML = ''; $$('[data-e]').forEach(x => x.textContent = '');
    if (!maSua && !$('#ncc').value) { $('#enc').textContent = 'Vui lòng chọn nhà cung cấp'; return $('#ferr').innerHTML = '<div class="alert red">! Chưa chọn nhà cung cấp</div>'; }
    const bad = items.filter(i => !(+i.sl > 0) || !Number.isInteger(+i.sl));
    if (bad.length) { bad.forEach(b => $(`[data-e="${b.ma}"]`).textContent = 'Số lượng phải lớn hơn 0'); return $('#ferr').innerHTML = '<div class="alert red">! Số lượng không hợp lệ</div>'; }
    const body = { maNCC: $('#ncc').value, chiTiet: items.map(i => ({ maNguyenLieu: i.ma, soLuongDat: +i.sl })) };
    try {
      const r = maSua ? await api('PUT', '/api/donhang/' + maSua, body) : await api('POST', '/api/donhang', body);
      toast(maSua ? 'Cập nhật đơn hàng thành công' : 'Lưu đơn thành công'); location.hash = '#/donhang/' + (maSua || r.maDonHang);
    } catch (e) { $('#ferr').innerHTML = `<div class="alert red">! ${esc(e.error)}</div>`; }
  };
}
async function pageDonChiTiet(ma) {
  const d = await api('GET', '/api/donhang/' + ma);
  shell(crumb('Nhà cung cấp', 'Đơn đặt hàng', ma), `<div class="row"><h2 class="title grow">Đơn đặt hàng ${ma}</h2>${badge(d.trangThai)}</div><br>
  <div class="card"><div class="grid4"><div><label class="f">Nhà cung cấp</label><b>${esc(d.tenNCC)}</b></div><div><label class="f">Số điện thoại</label>${esc(d.sdtNCC)}</div><div><label class="f">Ngày tạo</label>${fd(d.ngayDat)}</div><div><label class="f">Người lập</label>${esc(d.nguoiLap)}</div></div></div>
  <div class="card"><h3>Nguyên vật liệu</h3>${table([['Nguyên vật liệu', r => esc(r.tenNguyenLieu)], ['Đơn vị', r => esc(r.donViTinh)], ['Số lượng đặt', r => `<b>${r.soLuongDat}</b>`]], d.chiTiet)}</div>
  <div class="row end noprint"><button class="btn o" onclick="location.hash='#/donhang'">Quay lại</button>
    ${d.trangThai === 'ChoDatHang' ? `<button class="btn o" onclick="location.hash='#/donhang/${ma}/sua'">Chỉnh sửa</button>` : ''}
    <button class="btn o" id="xuat">Xuất đơn đặt hàng</button>${d.trangThai === 'ChoDatHang' ? '<button class="btn" id="gui">Đánh dấu đã gửi NCC</button>' : ''}</div>`);
  $('#xuat').onclick = () => {
    const m = modal(`<h3>Xuất đơn đặt hàng</h3><p class="muted">Chọn cách gửi đơn cho nhà cung cấp (qua Zalo hoặc Gmail).</p>
      <div class="opt" id="fx">📄 <span><b>Excel / Google Sheets (CSV)</b><small>DonDatHang_${ma}.csv</small></span></div><div class="opt" id="fp">🖨 <span><b>PDF</b><small>In hoặc lưu thành PDF từ trình duyệt</small></span></div>
      <div class="opt" id="fg">✉️ <span><b>Soạn Gmail</b><small>Mở thư Gmail đã điền sẵn nội dung đơn. Quản lý nhập email nhà cung cấp, đính kèm file (nếu cần) rồi tự bấm Gửi.</small></span></div>
      <div class="acts"><button class="btn o" data-close>Đóng</button></div>`);
    $('#fx').onclick = () => { csv(`DonDatHang_${ma}.csv`, ['Mã đơn', 'Nhà cung cấp', 'Nguyên vật liệu', 'Đơn vị', 'Số lượng'], d.chiTiet.map(c => [ma, d.tenNCC, c.tenNguyenLieu, c.donViTinh, c.soLuongDat])); m.close(); toast('Xuất file thành công'); };
    $('#fp').onclick = () => { m.close(); setTimeout(print, 200); };
    $('#fg').onclick = () => {
      const noiDung = `Kính gửi ${d.tenNCC},\n\nWinKids xin đặt hàng theo đơn ${ma} (ngày ${fd(d.ngayDat)}):\n` +
        d.chiTiet.map(c => `- ${c.tenNguyenLieu}: ${c.soLuongDat} ${c.donViTinh}`).join('\n') +
        `\n\nAnh/chị vui lòng xác nhận giúp thời gian giao hàng.\nTrân trọng,\n${S.me.hoTen} – Quản lý kho WinKids`;
      window.open('https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(`WinKids đặt hàng – ${ma}`) + '&body=' + encodeURIComponent(noiDung), '_blank');
      m.close(); toast('Đã mở thư Gmail soạn sẵn');
    };
  };
  if ($('#gui')) $('#gui').onclick = () => {
    const m = modal(`<h3>Xác nhận đã gửi đơn cho nhà cung cấp?</h3><p class="muted">Đơn ${ma} sẽ chuyển sang trạng thái "Đã đặt hàng" và không chỉnh sửa được nữa.</p>
      <div class="acts"><button class="btn o" data-close>Hủy</button><button class="btn" id="ok">Xác nhận</button></div>`);
    $('#ok').onclick = async () => { await api('POST', `/api/donhang/${ma}/dadat`); m.close(); toast('Đơn đã chuyển sang Đã đặt hàng'); pageDonChiTiet(ma); };
  };
}
async function pageNCC(mode) {
  const rows = await api('GET', '/api/ncc');
  const title = { them: 'Thêm nhà cung cấp', sua: 'Sửa thông tin nhà cung cấp', xoa: 'Xóa nhà cung cấp' }[mode];
  shell(crumb('Nhà cung cấp', { them: 'Thêm NCC', sua: 'Sửa NCC', xoa: 'Xóa NCC' }[mode]), `<div class="row"><h2 class="title grow">${title}</h2>${mode === 'them' ? '<button class="btn" id="add">+ Thêm nhà cung cấp</button>' : ''}</div><br>
  <div class="card"><div class="row"><h3 class="grow">Danh sách nhà cung cấp</h3><span class="muted">${rows.length} nhà cung cấp</span></div>
  ${table([['Tên nhà cung cấp', r => `<b>${esc(r.tenNCC)}</b>`], ['Số điện thoại', r => esc(r.soDienThoai)], ['Địa chỉ', r => esc(r.diaChi)], ['Trạng thái', () => '<span class="badge b-green">Đang hợp tác</span>'],
    ...(mode === 'them' ? [] : [['', r => mode === 'sua' ? `<button class="btn sm o" data-e="${r.maNCC}">Chỉnh sửa thông tin</button>` : `<button class="btn sm o red" data-d="${r.maNCC}">Xóa</button>`]])], rows, 'Chưa có nhà cung cấp')}</div>`);
  const form = ncc => {
    const m = modal(`<button class="x" data-close>✕</button><h3>${ncc ? 'Sửa thông tin nhà cung cấp' : 'Thêm nhà cung cấp'}</h3><br><div id="me"></div>
      <div class="field"><label class="f">Tên nhà cung cấp <i>*</i></label><input id="t" class="inp" value="${esc(ncc?.tenNCC)}" placeholder="Nhập tên nhà cung cấp"></div>
      <div class="field"><label class="f">Số điện thoại <i>*</i></label><input id="s" class="inp" value="${esc(ncc?.soDienThoai)}" placeholder="VD: 0905 123 456"></div>
      <div class="field"><label class="f">Địa chỉ</label><input id="d" class="inp" value="${esc(ncc?.diaChi)}"></div>
      <div class="acts"><button class="btn o" data-close>Hủy</button><button class="btn" id="ok">Lưu</button></div>`);
    $('#ok').onclick = async () => {
      try {
        const b = { tenNCC: $('#t').value, soDienThoai: $('#s').value, diaChi: $('#d').value };
        ncc ? await api('PUT', '/api/ncc/' + ncc.maNCC, b) : await api('POST', '/api/ncc', b);
        m.close(); toast(ncc ? 'Cập nhật nhà cung cấp thành công' : 'Thêm nhà cung cấp thành công'); pageNCC(mode);
      } catch (e) { $('#me').innerHTML = `<div class="alert red">! ${esc(e.error)}${e.trungVoi ? ' (trùng với ' + esc(e.trungVoi) + ')' : ''}</div>`; }
    };
  };
  if ($('#add')) $('#add').onclick = () => form();
  $$('[data-e]').forEach(b => b.onclick = () => form(rows.find(r => r.maNCC === b.dataset.e)));
  $$('[data-d]').forEach(b => b.onclick = () => {
    const n = rows.find(r => r.maNCC === b.dataset.d);
    const m = modal(`<div class="notice"><div class="big" style="background:#F59A23">!</div><h3>Xác nhận xóa nhà cung cấp?</h3><p class="muted">Nhà cung cấp ${esc(n.tenNCC)} sẽ bị xóa khỏi danh sách.</p>
      <div class="acts" style="justify-content:center"><button class="btn o" data-close>Hủy</button><button class="btn" id="ok">Xác nhận</button></div></div>`);
    $('#ok').onclick = async () => {
      m.close();
      try { await api('DELETE', '/api/ncc/' + n.maNCC); toast('Xóa nhà cung cấp thành công'); pageNCC(mode); }
      catch (e) { notice('err', 'Không thể xóa nhà cung cấp', e.error); }
    };
  });
}

/* ---------- UC 8: Hàng hóa (loại sản phẩm) ---------- */
async function pageHangHoa() {
  const [rows, dm, kho] = await Promise.all([api('GET', '/api/nguyenlieu'), api('GET', '/api/danhmuc'), api('GET', '/api/kho')]);
  shell(crumb('Hàng hóa'), `<div class="row"><h2 class="title grow">Quản lý danh mục hàng hóa</h2><button class="btn" id="add">+ Thêm loại sản phẩm</button></div><br>
  <div class="card"><div class="row"><input id="q" class="inp grow" placeholder="Nhập mã hoặc tên loại sản phẩm"><button class="btn" id="go">Tìm kiếm</button></div><div class="ferr" id="qe"></div></div>
  <div class="card" id="res"></div>`);
  const draw = list => $('#res').innerHTML = `<h3>Danh sách loại sản phẩm</h3>` + table([['Mã sản phẩm', r => esc(r.maNguyenLieu)], ['Tên sản phẩm', r => `<b>${esc(r.tenNguyenLieu)}</b>`], ['Đơn vị tính', r => esc(r.donViTinh)], ['Mô tả', r => esc(r.moTa)],
    ['Thao tác', r => `<button class="btn sm o" data-e="${r.maNguyenLieu}">Sửa</button> <button class="btn sm o red" data-d="${r.maNguyenLieu}">Xóa</button>`]], list, 'Không có danh mục sản phẩm để hiển thị');
  const bind = () => {
    $$('[data-e]').forEach(b => b.onclick = () => form(rows.find(r => r.maNguyenLieu === b.dataset.e)));
    $$('[data-d]').forEach(b => b.onclick = () => {
      const n = rows.find(r => r.maNguyenLieu === b.dataset.d);
      const m = modal(`<div class="notice"><div class="big" style="background:#B3261E">🗑</div><h3>Xác nhận xóa loại sản phẩm</h3><p class="muted">Bạn có chắc chắn muốn xóa loại sản phẩm "${esc(n.tenNguyenLieu)}" (${n.maNguyenLieu}) khỏi hệ thống không?</p>
        <div class="acts" style="justify-content:center"><button class="btn o" data-close>Hủy</button><button class="btn red" id="ok">Xóa</button></div></div>`);
      $('#ok').onclick = async () => { m.close(); try { await api('DELETE', '/api/nguyenlieu/' + n.maNguyenLieu); toast('Xóa loại sản phẩm thành công!'); pageHangHoa(); } catch (e) { toast(e.error || 'Có lỗi xảy ra, vui lòng thử lại sau!', 1); } };
    });
  };
  const form = n => {
    const m = modal(`<h3>${n ? 'Sửa loại sản phẩm' : 'Thêm loại sản phẩm'}</h3><p class="muted">${n ? 'Cập nhật thông tin loại sản phẩm. Các trường có dấu * là bắt buộc' : 'Nhập thông tin loại sản phẩm mới. Các trường có dấu * là bắt buộc.'}</p><div id="me"></div>
      <div class="field"><label class="f">Mã sản phẩm <i>*</i></label><input id="ma" class="inp" ${n ? 'readonly' : ''} value="${esc(n?.maNguyenLieu)}" placeholder="VD: NL-011"><div class="ferr" id="e_maNguyenLieu"></div></div>
      <div class="field"><label class="f">Tên sản phẩm <i>*</i></label><input id="ten" class="inp" value="${esc(n?.tenNguyenLieu)}" placeholder="Nhập tên sản phẩm"><div class="ferr" id="e_tenNguyenLieu"></div></div>
      <div class="grid3"><div class="field"><label class="f">Đơn vị tính <i>*</i></label><input id="dvt" class="inp" value="${esc(n?.donViTinh)}" placeholder="VD: hộp, kg, chai"><div class="ferr" id="e_donViTinh"></div></div>
        <div class="field"><label class="f">Danh mục</label><select id="dm" class="inp">${dm.map(d => `<option value="${d.maDanhMuc}" ${n?.maDanhMuc === d.maDanhMuc ? 'selected' : ''}>${esc(d.tenDanhMuc)}</option>`).join('')}</select></div>
        <div class="field"><label class="f">Kho</label><select id="kh" class="inp">${kho.map(k => `<option value="${k.maKho}" ${n?.maKho === k.maKho ? 'selected' : ''}>${esc(k.tenKho)}</option>`).join('')}</select></div></div>
      <div class="field"><label class="f">Mô tả</label><textarea id="mt" class="inp" rows="3" placeholder="Nhập mô tả (không bắt buộc)">${esc(n?.moTa)}</textarea></div>
      <div class="acts"><button class="btn o" data-close>Hủy</button><button class="btn" id="ok">Lưu</button></div>`);
    $('#ok').onclick = async () => {
      $$('.ferr', m.el).forEach(x => x.textContent = ''); $('#me').innerHTML = '';
      const b = { maNguyenLieu: $('#ma').value, tenNguyenLieu: $('#ten').value, donViTinh: $('#dvt').value, maDanhMuc: $('#dm').value, maKho: $('#kh').value, moTa: $('#mt').value };
      try { n ? await api('PUT', '/api/nguyenlieu/' + n.maNguyenLieu, b) : await api('POST', '/api/nguyenlieu', b); m.close(); toast(n ? 'Cập nhật loại sản phẩm thành công!' : 'Thêm loại sản phẩm thành công!'); pageHangHoa(); }
      catch (e) { if (e.field && $('#e_' + e.field)) $('#e_' + e.field).textContent = e.error; else $('#me').innerHTML = `<div class="alert red">! ${esc(e.error)}</div>`; }
    };
  };
  const search = () => {
    const q = $('#q').value.trim().toLowerCase(); $('#qe').textContent = '';
    if (!q) { $('#qe').textContent = 'Không được để trống!'; draw(rows); return bind(); }
    const list = rows.filter(r => r.maNguyenLieu.toLowerCase().includes(q) || r.tenNguyenLieu.toLowerCase().includes(q));
    if (!list.length) $('#qe').textContent = 'Không tìm thấy danh mục sản phẩm phù hợp!';
    draw(list); bind();
  };
  $('#add').onclick = () => form(); $('#go').onclick = search; $('#q').onkeydown = e => { if (e.key === 'Enter') search(); };
  draw(rows); bind();
}

/* ---------- UC 9: Báo cáo và thống kê – bám Figma ---------- */
const BC = {
  nhap: { ten: 'Báo cáo nhập kho', mo: 'Tổng hợp nguyên vật liệu, số lượng nhập và ngày nhập trong kỳ.', file: 'Bao-cao-nhap-kho', empty: 'Không có dữ liệu nhập kho trong kỳ đã chọn!',
    cols: [['Nguyên vật liệu', r => r.tenNguyenLieu], ['Số lượng nhập', r => `${r.soLuong} ${r.donViTinh}`], ['Ngày nhập', r => fd(r.ngay)]] },
  xuat: { ten: 'Báo cáo xuất kho', mo: 'Tổng hợp các phiếu xuất đã được quản lý xác nhận.', file: 'Bao-cao-xuat-kho', empty: 'Không có dữ liệu xuất kho trong kỳ đã chọn!',
    cols: [['Nguyên vật liệu', r => r.tenNguyenLieu], ['Số lượng xuất', r => `${r.soLuong} ${r.donViTinh}`], ['Ngày xuất', r => fd(r.ngay)]] },
  ton: { ten: 'Báo cáo hàng tồn kho', mo: 'Theo dõi tồn đầu kỳ, nhập, xuất và tồn cuối kỳ.', file: 'Bao-cao-hang-ton-kho', empty: 'Không có dữ liệu tồn kho trong kỳ đã chọn!',
    cols: [['Nguyên vật liệu', r => r.tenNguyenLieu], ['Tồn đầu kỳ', r => `${r.tonDau} ${r.donViTinh}`], ['Nhập trong kỳ', r => `${r.nhap} ${r.donViTinh}`], ['Xuất trong kỳ', r => `${r.xuat} ${r.donViTinh}`], ['Tồn cuối kỳ', r => `${r.tonCuoi} ${r.donViTinh}`]] },
  nhatky: { ten: 'Lịch sử chỉnh sửa', mo: 'Tra cứu nhật ký tạo, sửa, xóa phiếu và thay đổi số tồn.', file: 'Lich-su-chinh-sua', empty: 'Không tìm thấy lịch sử thao tác!',
    cols: [['Người thực hiện', r => r.nguoiThucHien], ['Thời gian', r => fdt(r.thoiGian).replace(' ', ' · ')], ['Nội dung chỉnh sửa', r => r.noiDung]] }
};
const bcCrumb = t => `Kho › <b>Báo cáo</b>${t ? ' › ' + esc(t) : ''}`;
function toastDark(msg) {
  const t = document.createElement('div'); t.className = 'toast-dark'; t.innerHTML = `<span>✓</span>${esc(msg)}`;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
}

function pageBaoCao() {
  shell(bcCrumb(), `<h2 class="title tk-title">Báo cáo và thống kê</h2>
  <div class="card"><div class="tk-head"><h3>Danh sách báo cáo</h3></div>
  ${Object.entries(BC).map(([k, c]) => `<div class="tk-row"><div class="grow"><b>${c.ten}</b><p>${c.mo}</p></div><button class="btn o" onclick="location.hash='#/baocao/${k}'">${k === 'nhatky' ? 'Tìm kiếm' : 'Xem báo cáo'}</button></div>`).join('')}</div>`);
}

/* Bộ chọn khoảng thời gian (Ngày / Tháng / Năm) */
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();
function datePicker(host, st, onApply) {
  let mode = 'ngay';
  const tmp = { tu: st.tu, den: st.den };
  const view = {};
  ['tu', 'den'].forEach(k => { const v = tmp[k] || todayISO(); view[k] = { y: +v.slice(0, 4), m: +v.slice(5, 7) }; });
  const years = []; for (let y = new Date().getFullYear() - 4; y <= new Date().getFullYear() + 1; y++) years.push(y);
  const sel = (k, f, opts) => `<select class="inp" data-k="${k}" data-f="${f}">${opts.map(o => `<option value="${o[0]}" ${o[0] === view[k][f] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  const cal = k => {
    const { y, m } = view[k], first = (new Date(y, m - 1, 1).getDay() + 6) % 7, n = lastDay(y, m);
    let cells = ''; for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= n; d++) { const v = iso(y, m, d); cells += `<button type="button" class="${tmp[k] === v ? 'on' : ''}" data-k="${k}" data-d="${v}">${d}</button>`; }
    return `<div class="dp-cal"><b>${k === 'tu' ? 'Bắt đầu' : 'Kết thúc'}</b><div class="dp-sel"><label>Tháng${sel(k, 'm', [...Array(12)].map((_, i) => [i + 1, i + 1]))}</label><label>Năm${sel(k, 'y', years.map(y => [y, y]))}</label></div>
      <div class="dp-grid"><i>T2</i><i>T3</i><i>T4</i><i>T5</i><i>T6</i><i>T7</i><i>CN</i>${cells}</div></div>`;
  };
  const month = k => `<div class="dp-cal"><b>${k === 'tu' ? 'Bắt đầu' : 'Kết thúc'}</b><div class="dp-sel"><label>Năm${sel(k, 'y', years.map(y => [y, y]))}</label></div>
    <div class="dp-months">${[...Array(12)].map((_, i) => { const v = k === 'tu' ? iso(view[k].y, i + 1, 1) : iso(view[k].y, i + 1, lastDay(view[k].y, i + 1));
      return `<button type="button" class="${tmp[k] === v ? 'on' : ''}" data-k="${k}" data-d="${v}">Tháng ${i + 1}</button>`; }).join('')}</div></div>`;
  const year = k => `<div class="dp-cal"><b>${k === 'tu' ? 'Bắt đầu' : 'Kết thúc'}</b><div class="dp-months">${years.map(y => { const v = k === 'tu' ? iso(y, 1, 1) : iso(y, 12, 31);
      return `<button type="button" class="${tmp[k] === v ? 'on' : ''}" data-k="${k}" data-d="${v}">${y}</button>`; }).join('')}</div></div>`;
  const draw = () => {
    const f = { ngay: cal, thang: month, nam: year }[mode];
    host.innerHTML = `<div class="dp-tabs">${[['ngay', 'Ngày'], ['thang', 'Tháng'], ['nam', 'Năm']].map(t => `<button type="button" class="${mode === t[0] ? 'on' : ''}" data-mode="${t[0]}">${t[1]}</button>`).join('')}</div>
      <div class="dp-two">${f('tu')}${f('den')}</div><div class="dp-foot"><button type="button" class="btn" id="dpOk">Áp dụng</button></div>`;
    $$('[data-mode]', host).forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    $$('select', host).forEach(s => s.onchange = () => { view[s.dataset.k][s.dataset.f] = +s.value; draw(); });
    $$('[data-d]', host).forEach(b => b.onclick = () => { tmp[b.dataset.k] = b.dataset.d; draw(); });
    $('#dpOk', host).onclick = () => { st.tu = tmp.tu; st.den = tmp.den; host.hidden = true; onApply(); };
  };
  draw(); host.hidden = false;
}

/* Biểu đồ biến động nhập / xuất theo Ngày – Tuần – Tháng – Năm (yêu cầu trong buổi phỏng vấn anh Bá Minh) */
const BD = { ma: null, nhom: null, loai: null };
const BD_MAU = { nhap: ['Nhập', '#3A72BF'], xuat: ['Xuất', '#D97706'] };
const dUTC = v => new Date(Date.UTC(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)));
const isoUTC = d => d.toISOString().slice(0, 10);
const ddmm = v => `${v.slice(8, 10)}/${v.slice(5, 7)}`;
function bdKy(v, nhom) {
  if (nhom === 'ngay') return v;
  if (nhom === 'thang') return v.slice(0, 7);
  if (nhom === 'nam') return v.slice(0, 4);
  const d = dUTC(v); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return isoUTC(d); // thứ Hai đầu tuần
}
function bdNhan(k, nhom, motNam) {
  if (nhom === 'ngay') return [ddmm(k), fd(k)];
  if (nhom === 'tuan') { const e = dUTC(k); e.setUTCDate(e.getUTCDate() + 6); return [ddmm(k), `Tuần ${ddmm(k)} – ${fd(isoUTC(e))}`]; }
  if (nhom === 'thang') return [motNam ? 'T' + +k.slice(5) : `T${+k.slice(5)}/${k.slice(0, 4)}`, `Tháng ${+k.slice(5)}/${k.slice(0, 4)}`];
  return [k, 'Năm ' + k];
}
async function bieuDo(loai, st, rows) {
  const host = $('#chart'); if (!host) return;
  const nls = await api('GET', '/api/nguyenlieu');
  if (!nls.length) return host.innerHTML = '';
  if (BD.loai !== loai) { BD.loai = loai; BD.ma = null; BD.nhom = null; }
  const span = Math.round((dUTC(st.den) - dUTC(st.tu)) / 864e5) + 1;
  const nhom = BD.nhom || (span <= 31 ? 'ngay' : span <= 140 ? 'tuan' : span <= 1100 ? 'thang' : 'nam');
  if (!BD.ma || !nls.some(n => n.maNguyenLieu === BD.ma)) { // mặc định: nguyên vật liệu có phát sinh lớn nhất trong kỳ
    const tong = {}; rows.forEach(r => tong[r.tenNguyenLieu] = (tong[r.tenNguyenLieu] || 0) + (loai === 'ton' ? (+r.nhap || 0) + (+r.xuat || 0) : +r.soLuong || 0));
    const top = Object.entries(tong).sort((a, b) => b[1] - a[1])[0];
    BD.ma = (top && nls.find(n => n.tenNguyenLieu === top[0]) || nls[0]).maNguyenLieu;
  }
  const nl = nls.find(n => n.maNguyenLieu === BD.ma), dv = nl.donViTinh;
  const data = await api('GET', `/api/baocao/bieudo?ma=${encodeURIComponent(BD.ma)}&tu=${st.tu}&den=${st.den}`);
  const series = loai === 'nhap' ? ['nhap'] : loai === 'xuat' ? ['xuat'] : ['nhap', 'xuat'];
  // tạo đủ các mốc trong kỳ (kể cả mốc bằng 0) để thấy rõ biến động
  const keys = []; for (let d = dUTC(st.tu); d <= dUTC(st.den); d.setUTCDate(d.getUTCDate() + 1)) { const k = bdKy(isoUTC(d), nhom); if (keys[keys.length - 1] !== k) keys.push(k); }
  const val = Object.fromEntries(keys.map(k => [k, { nhap: 0, xuat: 0 }]));
  data.forEach(r => { const k = bdKy(r.ngay, nhom); if (val[k]) { val[k].nhap += r.nhap; val[k].xuat += r.xuat; } });
  const motNam = new Set(keys.map(k => k.slice(0, 4))).size === 1;
  const tenTB = loai === 'nhap' ? 'nhập' : loai === 'xuat' ? 'xuất' : 'nhập và xuất';
  const tenNhom = { ngay: 'ngày', tuan: 'tuần', thang: 'tháng', nam: 'năm' }[nhom];
  const max = Math.max(0, ...keys.flatMap(k => series.map(s => val[k][s])));
  host.innerHTML = `<div class="tk-head bd-head"><div><h3>Biểu đồ biến động</h3><p class="muted">Số lượng ${tenTB} của <b>${esc(nl.tenNguyenLieu)}</b> theo ${tenNhom} (${esc(dv)})</p></div>
    <div class="bd-ctl"><select class="inp" id="bdNL">${nls.map(n => `<option value="${esc(n.maNguyenLieu)}" ${n.maNguyenLieu === BD.ma ? 'selected' : ''}>${esc(n.tenNguyenLieu)}</option>`).join('')}</select>
    <div class="bd-seg">${[['ngay', 'Ngày'], ['tuan', 'Tuần'], ['thang', 'Tháng'], ['nam', 'Năm']].map(t => `<button type="button" class="${nhom === t[0] ? 'on' : ''}" data-nhom="${t[0]}">${t[1]}</button>`).join('')}</div></div></div>
    ${series.length > 1 ? `<div class="bd-legend">${series.map(s => `<span><i style="background:${BD_MAU[s][1]}"></i>${BD_MAU[s][0]}</span>`).join('')}</div>` : ''}
    <div class="bd-plot" id="bdPlot">${max ? '' : `<div class="bd-none">Không có phát sinh ${tenTB} của ${esc(nl.tenNguyenLieu)} trong kỳ đã chọn</div>`}</div>
    ${max ? `<details class="bd-tbl"><summary>Xem số liệu dạng bảng</summary>${tkTable([[tenNhom[0].toUpperCase() + tenNhom.slice(1), k => esc(bdNhan(k, nhom, motNam)[1])], ...series.map(s => [`${BD_MAU[s][0]} (${esc(dv)})`, k => val[k][s]])], keys, '')}</details>` : ''}`;
  $('#bdNL').onchange = e => { BD.ma = e.target.value; bieuDo(loai, st, rows); };
  $$('[data-nhom]', host).forEach(b => b.onclick = () => { BD.nhom = b.dataset.nhom; bieuDo(loai, st, rows); });
  if (!max) return;
  // vẽ
  const plot = $('#bdPlot'), W = plot.clientWidth, H = 260, m = { l: 46, r: 8, t: 10, b: 28 };
  const step = (() => { const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; })();
  const top = step * Math.ceil(max / step), y = v => m.t + (H - m.t - m.b) * (1 - v / top);
  const n = keys.length, gw = (W - m.l - m.r) / n, k = series.length, gap = 2;
  const bw = Math.max(2, Math.min(32, (gw * 0.72 - (k - 1) * gap) / k));
  const bar = (x, v) => { const y0 = y(0), y1 = y(v), h = y0 - y1, r = Math.min(4, h, bw / 2); if (h <= 0) return '';
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + bw - r}Q${x + bw},${y1} ${x + bw},${y1 + r}V${y0}Z`; };
  let svg = `<svg width="${W}" height="${H}" role="img" aria-label="Biểu đồ số lượng ${tenTB} theo ${tenNhom}">`;
  for (let v = 0; v <= top + 1e-9; v += step) svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="bd-grid${v ? '' : ' base'}"/><text x="${m.l - 8}" y="${y(v) + 4}" class="bd-ax" text-anchor="end">${+v.toFixed(2)}</text>`;
  const every = Math.ceil(n / 12);
  keys.forEach((key, i) => {
    const x0 = m.l + i * gw, sx = x0 + (gw - (k * bw + (k - 1) * gap)) / 2;
    svg += `<rect class="bd-hl" x="${x0}" y="${m.t}" width="${gw}" height="${H - m.t - m.b}"/>`;
    series.forEach((s, j) => { svg += `<path d="${bar(sx + j * (bw + gap), val[key][s])}" fill="${BD_MAU[s][1]}"/>`; });
    if (i % every === 0) svg += `<text x="${x0 + gw / 2}" y="${H - 8}" class="bd-ax" text-anchor="middle">${esc(bdNhan(key, nhom, motNam)[0])}</text>`;
    svg += `<rect class="bd-hit" data-i="${i}" x="${x0}" y="${m.t}" width="${gw}" height="${H - m.t - m.b}"/>`;
  });
  plot.innerHTML = svg + '</svg><div class="bd-tip" hidden></div>';
  const tip = $('.bd-tip', plot), hls = $$('.bd-hl', plot);
  $$('.bd-hit', plot).forEach(r => {
    r.onmouseenter = () => { const i = +r.dataset.i, key = keys[i]; hls.forEach((h, j) => h.classList.toggle('on', j === i));
      tip.innerHTML = `<b>${esc(bdNhan(key, nhom, motNam)[1])}</b>${series.map(s => `<div><i style="background:${BD_MAU[s][1]}"></i>${BD_MAU[s][0]}: <b>${val[key][s]} ${esc(dv)}</b></div>`).join('')}`;
      tip.hidden = false; const xr = m.l + (i + 1) * gw + 6, xl = m.l + i * gw - 6 - tip.offsetWidth; tip.style.left = (xr + tip.offsetWidth <= W ? xr : Math.max(xl, 0)) + 'px'; };
    r.onmouseleave = () => { tip.hidden = true; hls.forEach(h => h.classList.remove('on')); };
  });
}

async function pageBaoCaoChiTiet(loai) {
  const c = BC[loai]; if (!c) return pageBaoCao();
  const nk = loai === 'nhatky';
  const d = new Date(), st = nk ? { tu: '', den: '' } : { tu: iso(d.getFullYear(), d.getMonth() + 1, 1), den: iso(d.getFullYear(), d.getMonth() + 1, lastDay(d.getFullYear(), d.getMonth() + 1)) };
  const daTao = [];
  shell(bcCrumb(c.ten), `<div class="tk-top"><h2 class="title tk-title">${c.ten}</h2>${backBtn('#/baocao')}</div>
  <div class="card bc-filter"><h3>Khoảng thời gian</h3><div class="tk-frow">
    <div class="bc-date"><label class="f">Bắt đầu</label><button type="button" class="inp" id="tu"></button></div>
    <div class="bc-date"><label class="f">Kết thúc</label><button type="button" class="inp" id="den"></button></div>
    <button class="btn" id="xem">${nk ? 'Tìm kiếm' : 'Xem báo cáo'}</button><button class="btn o" id="xf">Xuất file</button></div>
    <div class="dp" id="dp" hidden></div><div id="loi"></div></div>
  <div class="card" id="res"></div>${nk ? '' : '<div class="card" id="chart"></div>'}<div id="gui"></div>`);
  const ky = () => `${fd(st.tu)} – ${fd(st.den)}`;
  const showDates = () => { $('#tu').innerHTML = `<span>${st.tu ? fd(st.tu) : 'dd/mm/yyyy'}</span>${I('chev')}`; $('#den').innerHTML = `<span>${st.den ? fd(st.den) : 'dd/mm/yyyy'}</span>${I('chev')}`; };
  showDates();
  const dp = $('#dp');
  $('#tu').onclick = $('#den').onclick = e => { e.stopPropagation(); if (!dp.hidden) return dp.hidden = true; datePicker(dp, st, () => { showDates(); load(); }); };
  dp.onclick = e => e.stopPropagation();
  document.addEventListener('click', function off() { if (!document.body.contains(dp)) return document.removeEventListener('click', off); dp.hidden = true; });
  let last = [], hopLe = true;
  const load = async () => {
    $('#loi').innerHTML = ''; $('#tu').classList.remove('err'); $('#den').classList.remove('err');
    const thead = `<div class="tk-box"><table class="tk-table"><thead><tr>${c.cols.map(x => `<th>${x[0]}</th>`).join('')}</tr></thead><tbody>`;
    if ((st.tu && st.den && st.tu > st.den) || (!nk && (!st.tu || !st.den))) {
      hopLe = false; last = []; if ($('#chart')) $('#chart').innerHTML = '';
      $('#tu').classList.add('err'); $('#den').classList.add('err');
      $('#loi').innerHTML = '<div class="tk-alert red"><i></i>Khoảng thời gian không hợp lệ!</div>';
      $('#res').innerHTML = `<div class="tk-head"><h3>${nk ? 'Nhật ký thao tác' : 'Kết quả báo cáo'}</h3>${nk ? '' : '<span class="muted">Chưa áp dụng bộ lọc</span>'}</div>
        ${nk ? '' : '<p class="muted bc-hint">Chưa hiển thị báo cáo. Vui lòng chọn lại khoảng thời gian hợp lệ và nhấn “Xem báo cáo”.</p>'}
        ${thead}<tr><td colspan="${c.cols.length}" class="tk-empty">Chờ chọn lại khoảng thời gian</td></tr></tbody></table></div>`;
      return;
    }
    try {
      last = await api('GET', `/api/baocao/${loai}?tu=${st.tu}&den=${st.den}`); hopLe = true;
      if (nk && !st.tu && !st.den) last = last.slice(0, 50);
      const tieuDe = nk ? (st.tu || st.den ? 'Nhật ký thao tác' : 'Tất cả lịch sử gần đây nhất') : 'Kết quả báo cáo';
      const phai = st.tu || st.den ? `${st.tu ? fd(st.tu) : '…'} – ${st.den ? fd(st.den) : '…'}` : '';
      $('#res').innerHTML = `<div class="tk-head"><h3>${tieuDe}</h3><span class="muted">${phai}</span></div>` +
        tkTable(c.cols.map(x => [x[0], r => esc(x[1](r))]), last, c.empty);
      if (!nk) bieuDo(loai, st, last);
    } catch (e) { hopLe = false; last = []; $('#loi').innerHTML = `<div class="tk-alert red"><i></i>${esc(e.error || 'Có lỗi xảy ra')}</div>`; }
  };
  const tenFile = (ext) => { const v = st.den || st.tu || todayISO(); return `${c.file}_${v.slice(5, 7)}-${v.slice(0, 4)}.${ext}`; };
  const xuatExcel = name => csv(name, c.cols.map(x => x[0]), last.map(r => c.cols.map(x => x[1](r))));
  const xuatPdf = () => {
    const w = window.open('', '_blank'); if (!w) return false;
    w.document.write(`<html><head><meta charset="utf-8"><title>${c.ten}</title><style>body{font-family:Arial;padding:24px;color:#1B2A41}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccd;padding:8px;text-align:left;font-size:13px}th{background:#FDE7C8}</style></head><body>
      <h2>${c.ten}</h2><div>${st.tu || st.den ? 'Kỳ: ' + esc(ky()) : 'Tất cả lịch sử gần đây nhất'}</div><table><tr>${c.cols.map(x => `<th>${x[0]}</th>`).join('')}</tr>${last.map(r => `<tr>${c.cols.map(x => `<td>${esc(x[1](r))}</td>`).join('')}</tr>`).join('')}</table></body></html>`);
    w.document.close(); w.focus(); w.print(); return true;
  };
  $('#xf').onclick = () => {
    if (!hopLe || !last.length) return notice('err', 'Xuất file không thành công, vui lòng thử lại!');
    let dinhDang = 'Excel';
    const m = modal(`<button class="x" data-close>✕</button><h3>Xuất file</h3><div class="bc-mod"><b>${c.ten}</b><p>${st.tu || st.den ? 'Kỳ: ' + ky() : 'Tất cả lịch sử gần đây nhất'}</p>
      <label class="f">Định dạng file</label><div class="bc-fmt"><button type="button" class="on" data-f="Excel"><i></i>Excel / Google Sheets</button><button type="button" data-f="PDF"><i></i>PDF</button></div>
      <p class="bc-tip">File tải về máy. Quản lý tự gửi file cho chủ quán (Zalo, Gmail…).</p></div>
      <div class="acts"><button class="btn o" data-close>Hủy</button><button class="btn" id="ok">Xuất file</button></div>`);
    $$('[data-f]', m.el).forEach(b => b.onclick = () => { dinhDang = b.dataset.f; $$('[data-f]', m.el).forEach(x => x.classList.toggle('on', x === b)); });
    $('#ok', m.el).onclick = () => {
      const name = tenFile(dinhDang === 'Excel' ? 'csv' : 'pdf');
      let ok = true;
      try { dinhDang === 'Excel' ? xuatExcel(name) : (ok = xuatPdf()); } catch { ok = false; }
      m.close();
      if (!ok) return notice('err', 'Xuất file không thành công, vui lòng thử lại!');
      api('POST', '/api/baocao/ghinhan', { tenFile: name, noiDung: `Xuất ${c.ten.toLowerCase()} (${dinhDang === 'Excel' ? 'Excel / Google Sheets' : 'PDF'})${st.tu || st.den ? ' kỳ ' + ky() : ''}` }).catch(() => { });
      if (nk) {
        $('#gui').innerHTML = `<div class="tk-alert green"><i></i>Đã tạo và tải về máy: ${esc(name)} · Định dạng ${dinhDang === 'Excel' ? 'Excel / Google Sheets' : 'PDF'}.</div>`;
        toastDark('Tải nhật ký thành công');
      } else {
        daTao.unshift([name, dinhDang]);
        $('#gui').innerHTML = `<div class="card"><div class="tk-head"><h3>Báo cáo đã được tạo</h3></div>${daTao.map(f => `<div class="bc-file"><b>${esc(f[0])}</b><span class="badge b-green">Đã tạo · ${f[1] === 'Excel' ? 'Excel / Google Sheets' : 'PDF'}</span></div>`).join('')}</div>`;
        toastDark('Xuất báo cáo thành công');
      }
    };
  };
  $('#xem').onclick = load; load();
}

/* ---------- UC 10: Tài khoản ---------- */
async function pageTaiKhoan() {
  const rows = await api('GET', '/api/taikhoan');
  shell(crumb('Tài khoản'), `<div class="row"><h2 class="title grow">Tài khoản</h2><button class="btn" id="add">Tạo tài khoản</button></div><br>
  <div class="card"><div class="row"><h3 class="grow">Danh sách tài khoản</h3><span class="muted">${rows.length} tài khoản</span></div>
  ${table([['Họ tên', r => `<b>${esc(r.hoTen)}</b>`], ['Số điện thoại', r => esc(r.soDienThoai)], ['Quyền', r => badge(r.quyen)], ['Ngày tạo', r => fd(r.ngayTao)], ['Thao tác', r => `<button class="btn sm o" data-p="${r.maTaiKhoan}">Phân quyền</button>`]], rows)}</div>`);
  $('#add').onclick = () => {
    const m = modal(`<button class="x" data-close>✕</button><h3>Tạo tài khoản</h3><br><div id="me"></div>
      <div class="field"><label class="f">Họ tên</label><input id="h" class="inp" placeholder="Nhập họ tên"></div>
      <div class="field"><label class="f">Số điện thoại</label><input id="s" class="inp" placeholder="VD: 0905 123 456"></div>
      <div class="field"><label class="f">Mật khẩu</label><input id="p" type="password" class="inp" placeholder="Nhập mật khẩu"></div>
      <div class="acts"><button class="btn" id="ok">Xác nhận tạo</button></div>`);
    $('#ok').onclick = async () => {
      try { await api('POST', '/api/taikhoan', { hoTen: $('#h').value, soDienThoai: $('#s').value, matKhau: $('#p').value }); m.close(); toast('Tạo tài khoản thành công'); pageTaiKhoan(); }
      catch (e) { if (e.status === 409) { m.close(); notice('err', 'Số điện thoại đã được đăng ký', `Số ${e.soDienThoai} đã được dùng cho một tài khoản khác.`); } else $('#me').innerHTML = `<div class="alert red">! ${esc(e.error)}</div>`; }
    };
  };
  $$('[data-p]').forEach(b => b.onclick = () => {
    const t = rows.find(r => r.maTaiKhoan === b.dataset.p); let chon = t.maPhanQuyen;
    const m = modal(`<button class="x" data-close>✕</button><h3>Phân quyền</h3><p class="muted">${esc(t.hoTen)} · ${esc(t.soDienThoai)}</p><div id="me"></div><label class="f">Danh sách quyền</label>
      ${[['QuanLy', 'Quản lý'], ['NhanVien', 'Nhân viên']].map(([v, n]) => `<div class="opt ${chon === v ? 'on' : ''}" data-v="${v}"><input type="checkbox" ${chon === v ? 'checked' : ''}><span>${n}</span></div>`).join('')}
      <div class="acts"><button class="btn" id="ok">Lưu thiết lập</button></div>`);
    $$('.opt', m.el).forEach(o => o.onclick = () => { const on = !o.classList.contains('on'); $$('.opt', m.el).forEach(x => { x.classList.remove('on'); $('input', x).checked = false; }); if (on) { o.classList.add('on'); $('input', o).checked = true; chon = o.dataset.v; } else chon = null; });
    $('#ok').onclick = async () => {
      if (!chon) return $('#me').innerHTML = '<div class="alert red">! Vui lòng chọn ít nhất một quyền cho tài khoản</div>';
      try { await api('PUT', `/api/taikhoan/${t.maTaiKhoan}/quyen`, { maPhanQuyen: chon }); m.close(); toast('Cập nhật quyền thành công'); pageTaiKhoan(); } catch (e) { $('#me').innerHTML = `<div class="alert red">! ${esc(e.error)}</div>`; }
    };
  });
}

/* ---------- bộ định tuyến ---------- */
async function router() {
  $$('.overlay:not(.keep), .menu').forEach(o => o.remove());
  const h = location.hash.split('?')[0] || '#/tongquan';
  if (h === '#/login') return pageLogin();
  if (!S.me) {
    try { S.me = await api('GET', '/api/me'); }
    catch (e) {
      if (e && e.status === 401) return; // chưa đăng nhập: api() đã chuyển sang trang đăng nhập
      // không gọi được máy chủ: báo rõ thay vì để trang trắng
      const local = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
      $('#app').innerHTML = `<div class="srv-err"><div class="card"><div class="big">!</div><h2>Không kết nối được với máy chủ</h2>
        ${e && e.error ? `<p><b>${esc(e.error)}</b></p>` : ''}
        ${local ? `<p>Cửa sổ đen (máy chủ web) có thể đã bị đóng hoặc đang báo lỗi.</p>
        <ol><li>Mở lại cửa sổ đen: bấm đúp <b>start-windows.bat</b> (hoặc gõ <code>.\\start-windows.bat</code> trong VS Code).</li>
        <li>Nếu cửa sổ đen hiện chữ đỏ/lỗi, chụp lại màn hình đó.</li><li>Bấm <b>Thử lại</b> bên dưới.</li></ol>`
        : `<ol><li>Kiểm tra mạng Internet.</li><li>Trên Vercel: vào <b>Settings › Environment Variables</b> kiểm tra <code>TURSO_DATABASE_URL</code> và <code>TURSO_AUTH_TOKEN</code>, rồi Redeploy.</li><li>Bấm <b>Thử lại</b>; nếu vẫn lỗi, chụp màn hình gửi người phụ trách.</li></ol>`}
        <button class="btn" onclick="location.reload()">Thử lại</button></div></div>`;
      return;
    }
  }
  const ql = S.me.role === 'QuanLy', p = h.split('/').slice(1);
  const qlOnly = ['quanlytonkho', 'kiemtra', 'theodoi', 'canhbao', 'hanghoa', 'donhang', 'ncc', 'baocao', 'taikhoan'];
  if (qlOnly.includes(p[0]) && !ql) { location.hash = '#/tongquan'; return; }
  try {
    switch (p[0]) {
      case 'tracuu': return await pageTraCuu();
      case 'nhapkho': return p[1] ? await pageNhapForm(p[1]) : await pageNhapKho();
      case 'xuatkho': return p[1] === 'tao' ? await pageXuatForm() : await pageXuatKho();
      case 'lichsu': { const t = new URLSearchParams(location.hash.split('?')[1]).get('tab'); return await pageLichSu(p[1] || t); }
      case 'quanlytonkho': return await pageQuanLyTonKho();
      case 'kiemtra': return await pageKiemTra(p[1], p[2] && decodeURIComponent(p[2]));
      case 'theodoi': return await pageTheoDoi();
      case 'canhbao': return await pageCanhBao();
      case 'donhang': return p[1] === 'tao' ? await pageDonForm() : p[2] === 'sua' ? await pageDonForm(p[1]) : p[1] ? await pageDonChiTiet(p[1]) : await pageDonHang();
      case 'ncc': return await pageNCC(p[1] || 'them');
      case 'hanghoa': return await pageHangHoa();
      case 'baocao': return p[1] ? await pageBaoCaoChiTiet(p[1]) : pageBaoCao();
      case 'taikhoan': return await pageTaiKhoan();
      default: return await pageTongQuan();
    }
  } catch (e) { console.error(e); toast(e.error || 'Có lỗi xảy ra', 1); }
}
addEventListener('hashchange', router);
router();
