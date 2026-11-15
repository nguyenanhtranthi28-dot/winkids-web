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
  // Ảnh chụp từ camera điện thoại có thể là JPG, PNG, HEIC hoặc WEBP: đều được chuyển sang JPG bên dưới
  if (!/^image\/(png|jpe?g|heic|heif|webp)$/i.test(f.type || 'image/jpeg')) return no('Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG hoặc PNG.');
  if (f.size > 20 * 1024 * 1024) return no('Ảnh vượt quá 20MB.');
  const r = new FileReader(); r.onerror = () => no('Không đọc được ảnh');
  r.onload = () => {
    const img = new Image(); img.onerror = () => no('Không đọc được ảnh. Vui lòng chụp lại hoặc chọn ảnh JPG, PNG.');
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
/* ---------- Thanh gợi ý & ô chọn theo Figma (thay cho datalist / select mặc định của trình duyệt) ---------- */
const boDau = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
// Gợi ý khi gõ: getItems() trả về [{ v: 'tên', sub: 'dòng phụ' }]
function goiY(input, getItems, onPick) {
  const wrap = document.createElement('div'); wrap.className = 'gy-wrap';
  input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
  const pn = document.createElement('div'); pn.className = 'gy-panel'; wrap.appendChild(pn);
  let list = [], idx = -1, imLang = false;
  const close = () => { pn.classList.remove('on'); idx = -1; };
  const render = () => {
    const q = boDau(input.value.trim());
    list = getItems().filter(it => !q || boDau(it.v).includes(q)).slice(0, 8);
    if (!list.length) { pn.innerHTML = q ? '<div class="gy-none">Không có gợi ý phù hợp</div>' : ''; pn.classList.toggle('on', !!q); return; }
    pn.innerHTML = list.map((it, i) => `<div class="gy-it ${i === idx ? 'on' : ''}" data-i="${i}"><b>${esc(it.v)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</div>`).join('');
    pn.classList.add('on');
  };
  const pick = i => { input.value = list[i].v; close(); imLang = true; input.dispatchEvent(new Event('input')); imLang = false; onPick && onPick(list[i]); };
  input.addEventListener('focus', render); input.addEventListener('input', () => { input.classList.remove('err'); if (imLang) return; idx = -1; render(); });
  input.addEventListener('keydown', e => {
    if (!pn.classList.contains('on') || !list.length) return;
    if (e.key === 'ArrowDown') { idx = (idx + 1) % list.length; render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = (idx - 1 + list.length) % list.length; render(); e.preventDefault(); }
    else if (e.key === 'Enter' && idx >= 0) { pick(idx); e.preventDefault(); e.stopImmediatePropagation(); }
    else if (e.key === 'Escape') close();
  });
  pn.addEventListener('mousedown', e => { const it = e.target.closest('.gy-it'); if (it) { e.preventDefault(); pick(+it.dataset.i); } });
  input.addEventListener('blur', () => setTimeout(close, 120));
}
// Ô chọn (select) hiển thị theo Figma; vẫn giữ <select> gốc để code đọc .value và nhận sự kiện change
const _selVal = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
Object.defineProperty(HTMLSelectElement.prototype, 'value', { get() { return _selVal.get.call(this); }, set(v) { _selVal.set.call(this, v); if (this._dd) this._dd(); }, configurable: true });
function dropdown(sel) {
  if (sel._dd || sel.multiple) return;
  const w = document.createElement('div'); w.className = 'dd' + (sel.style.maxWidth ? '' : ''); if (sel.style.maxWidth) w.style.maxWidth = sel.style.maxWidth;
  sel.parentNode.insertBefore(w, sel); w.appendChild(sel); sel.classList.add('dd-native'); sel.tabIndex = -1;
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'inp dd-btn'; w.appendChild(btn);
  const pn = document.createElement('div'); pn.className = 'dd-panel'; w.appendChild(pn);
  const sync = () => {
    const o = sel.options[sel.selectedIndex];
    btn.innerHTML = `<span class="${!sel.value ? 'dd-ph' : ''}">${esc(o ? o.text : '')}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>`;
    btn.disabled = sel.disabled; w.classList.toggle('err', sel.classList.contains('err'));
  };
  sel._dd = sync; sync();
  const close = () => { w.classList.remove('open'); document.removeEventListener('mousedown', out); };
  const out = e => { if (!w.contains(e.target)) close(); };
  btn.onclick = () => {
    if (w.classList.contains('open')) return close();
    $$('.dd.open').forEach(x => x.classList.remove('open'));
    pn.innerHTML = [...sel.options].map((o, i) => `<div class="dd-it ${i === sel.selectedIndex ? 'on' : ''} ${o.dataset.sub ? 'sub' : ''}" data-i="${i}"><span>${esc(o.text)}</span>${o.dataset.sub ? `<small>${esc(o.dataset.sub)}</small>` : ''}</div>`).join('');
    w.classList.add('open'); document.addEventListener('mousedown', out);
    const on = $('.dd-it.on', pn); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  pn.onclick = e => { const it = e.target.closest('.dd-it'); if (!it) return; sel.selectedIndex = +it.dataset.i; sync(); close(); sel.dispatchEvent(new Event('change', { bubbles: true })); };
  btn.onkeydown = e => { if (e.key === 'Escape') close(); };
  new MutationObserver(sync).observe(sel, { attributes: true, childList: true, subtree: true });
}
// Các màn UC 6, UC 9 đã bám Figma bằng ô chọn riêng nên giữ nguyên
new MutationObserver(() => $$('select.inp:not(.dd-native)').filter(x => !x.closest('.tk-sel,.tk-filter,.bc-filter,.bd-ctl,.tk-frow')).forEach(dropdown)).observe(document.documentElement, { childList: true, subtree: true });

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
  'Hàng hóa': '#/hanghoa', 'Thêm loại sản phẩm': '#/hanghoa/them', 'Sửa loại sản phẩm': '#/hanghoa/sua', 'Xóa loại sản phẩm': '#/hanghoa/xoa', 'Tìm kiếm danh mục sản phẩm': '#/hanghoa/timkiem', 'Quản lý tồn kho': '#/quanlytonkho', 'Kiểm tra phiếu nhập': '#/kiemtra/nhap', 'Kiểm tra phiếu xuất': '#/kiemtra/xuat',
  'Theo dõi tồn kho': '#/theodoi', 'Cảnh báo tự động': '#/canhbao', 'Tra cứu thông tin': '#/tracuu', 'Xem lịch sử tồn kho': '#/lichsu',
  'Lịch sử nhập kho': '#/lichsu/nhap', 'Lịch sử xuất kho': '#/lichsu/xuat', 'Nhà cung cấp': '#/donhang', 'Đơn đặt hàng': '#/donhang',
  'Thêm NCC': '#/ncc/them', 'Sửa NCC': '#/ncc/sua', 'Xóa NCC': '#/ncc/xoa', 'Tạo đơn đặt hàng': '#/donhang/tao', 'Báo cáo': '#/baocao', 'Báo cáo nhập kho': '#/baocao/nhap',
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
  const hh = /^#\/(kiemtra|theodoi|canhbao)(\/|$)/.test(h) ? '#/quanlytonkho' : h;
  const hh2 = h === '#/ncc/ds' ? '#/ncc/them' : null; // các màn con của Quản lý tồn kho
  const isAct = href => href && ((hh2 || hh) === href || (hh2 || hh).startsWith(href + '/'));
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
const lgSvg = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const LG_IC = {
  user: lgSvg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>'),
  lock: lgSvg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  eye: lgSvg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: lgSvg('<path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>')
};
function pageLogin() {
  $('#app').innerHTML = `<div class="login"><div class="left"><div class="logo"><img src="/logo.png" alt="WinKids" style="width:150px"></div><h1>Hệ thống quản lý kho</h1><p>Quản lý nhập, xuất và tồn kho nhanh chóng, chính xác</p></div>
  <div class="right"><div class="card" style="padding:30px"><h2 class="title">Đăng nhập</h2><p class="sub-t">Vui lòng nhập tài khoản để vào hệ thống.</p>
    <div class="field"><label class="f">Tên đăng nhập <i>*</i></label><div class="lg-inp"><span class="lg-ic">${LG_IC.user}</span><input id="lu" class="inp" inputmode="tel" autocomplete="username" placeholder="Nhập số điện thoại"></div><div class="ferr" id="eu"></div></div>
    <div class="field"><label class="f">Mật khẩu <i>*</i></label><div class="lg-inp"><span class="lg-ic">${LG_IC.lock}</span><input id="lp" type="password" class="inp" autocomplete="current-password" placeholder="Nhập mật khẩu"><button type="button" class="lg-eye" id="eye" title="Hiện mật khẩu" aria-label="Hiện mật khẩu">${LG_IC.eye}</button></div><div class="ferr" id="ep"></div></div>
    <div id="lerr"></div>
    <button class="btn" style="width:100%;margin-top:24px" id="lb">Đăng nhập</button></div></div></div>`;
  $('#eye').onclick = () => { const i = $('#lp'), hien = i.type === 'password'; i.type = hien ? 'text' : 'password'; $('#eye').innerHTML = hien ? LG_IC.eyeOff : LG_IC.eye; $('#eye').title = hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'; };
  const go = async () => {
    const u = $('#lu').value.trim(), p = $('#lp').value; $('#lerr').innerHTML = '';
    $('#eu').textContent = u ? '' : 'Không được để trống!'; $('#ep').textContent = p ? '' : 'Không được để trống!';
    $('#lu').classList.toggle('err', !u); $('#lp').classList.toggle('err', !p);
    if (!u || !p) return;
    try { await api('POST', '/api/login', { soDienThoai: u, matKhau: p }); S.me = await api('GET', '/api/me'); location.hash = '#/tongquan'; }
    catch (e) { $('#lerr').innerHTML = `<div class="lg-err">${NK_IC.err}<span>${esc(e.error || 'Đăng nhập không thành công!')}</span></div>`; }
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
  <div class="row"><div class="grow"><input id="q" class="inp" autocomplete="off" placeholder="Nhập tên nguyên vật liệu cần tìm"></div><button class="btn" id="go">Tìm kiếm</button></div><div class="ferr" id="qerr"></div><br>
  <div class="row"><div><label class="f">Danh mục</label><select id="dm" class="inp"><option value="">Tất cả danh mục</option>${dm.map(d => `<option value="${d.maDanhMuc}">${esc(d.tenDanhMuc)}</option>`).join('')}</select></div>
    <div><label class="f">Kho</label><select id="kho" class="inp"><option value="">Tất cả kho</option>${kho.map(k => `<option value="${k.maKho}">${esc(k.tenKho)}</option>`).join('')}</select></div>
    <button class="btn link" id="clr" style="margin-top:20px">Xóa bộ lọc</button></div><br>
  <div class="card" id="res"></div>`);
  const all = await api('GET', '/api/nguyenlieu');
  goiY($('#q'), () => all.map(n => ({ v: n.tenNguyenLieu, sub: `${n.tenDanhMuc} · ${n.tenKho}` })), () => load());
  const load = async () => {
    const q = $('#q').value.trim(), p = new URLSearchParams({ dm: $('#dm').value, kho: $('#kho').value });
    const k = boDau(q); // tìm không phân biệt dấu: "sua" vẫn ra "Sữa"
    const rows = (await api('GET', '/api/nguyenlieu?' + p)).filter(r => !k || boDau(r.tenNguyenLieu).includes(k) || boDau(r.maNguyenLieu).includes(k));
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

/* ---------- UC 3: Xử lý nhập kho – bám Figma (3 bước: Kiểm tra hàng → Hóa đơn → Lô hàng/HSD) ---------- */
const NK_IC = {
  cam: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5M7 10l5-5 5 5M5 19h14"/></svg>',
  box: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
  clip: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 11h6M9 15h6"/></svg>',
  ok: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12.5l3.2 3L17 9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  err: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 7v6M12 16.5v.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17v.5" stroke-linecap="round"/></svg>',
  camOff: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M9 5h6l2 3h3v10M17 19H4V8h3"/><path d="M10 10.5a3.5 3.5 0 0 0 4.5 4.5"/></svg>'
};
const nkStepper = n => `<div class="nk-steps">${['Kiểm tra hàng', 'Hóa đơn', 'Lô hàng/HSD'].map((t, i) =>
  `<span class="nk-step ${i + 1 < n ? 'done' : i + 1 === n ? 'cur' : ''}"><i>${i + 1 < n ? NK_IC.ok : i + 1}</i>${t}</span>`).join('')}</div>`;
const nkHead = (title, right = '') => `<div class="nk-head"><h2 class="title">${title}</h2><div class="nk-right" id="nkRight">${right}</div></div>`;
// Thông báo dạng dải màu ở góc phải tiêu đề (theo Figma); giu = true thì không tự ẩn
function nkFlash(msg, kind = 'ok', giu = false) {
  const r = $('#nkRight'); if (!r) return toast(msg, kind !== 'ok');
  if (r._t) clearTimeout(r._t); if (r._goc === undefined) r._goc = r.innerHTML;
  r.innerHTML = `<div class="nk-flash ${kind}">${kind === 'ok' ? NK_IC.ok : NK_IC.err}<span>${esc(msg)}</span></div>`;
  if (!giu) r._t = setTimeout(() => { r.innerHTML = r._goc; r._goc = undefined; }, 4000);
}
function nkNetBar(msg) {
  let b = $('.nk-net'); if (!b) { b = document.createElement('div'); b.className = 'nk-net'; $('.page').prepend(b); }
  b.innerHTML = `${NK_IC.err}<span>${esc(msg)}</span>`;
}
const nkLoiMang = e => !e || e.status === undefined || e.status === 0 || e instanceof TypeError;
const kichThuoc = dataUrl => { const b = (dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75; return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB'; };
// Trạng thái bước 1–2 của từng đơn (lưu tạm trên trình duyệt để không mất khi tải lại trang)
const NK = {};
const nkState = ma => {
  if (!NK[ma]) { try { NK[ma] = JSON.parse(sessionStorage.getItem('nk:' + ma)); } catch { } }
  return NK[ma] || (NK[ma] = { sl: {}, saiLech: {}, xong: false, hoaDon: null, hd: {} });
};
const nkSave = ma => { try { sessionStorage.setItem('nk:' + ma, JSON.stringify(NK[ma])); } catch { } };
const nkClear = ma => { delete NK[ma]; try { sessionStorage.removeItem('nk:' + ma); } catch { } };

// Chọn ảnh từ máy (UC 3.2 bước 2a)
function nkChonFile() {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = async () => { const f = i.files[0]; if (!f) return res(null);
      try { res(await fileToDataUrl(f)); } catch (m) { nkKhongHoTro(); res(null); } };
    i.click();
  });
}
function nkKhongHoTro() {
  modal(`<div class="notice n-err"><div class="big err-i">${NK_IC.err}</div><h3>Không hỗ trợ định dạng này</h3><p class="muted">Vui lòng chọn ảnh JPG hoặc PNG.</p><div class="acts"><button class="btn o" data-close>Đóng</button></div></div>`, 'narrow');
}
// Chụp ảnh bằng camera (UC 3.2, UC 3.5). Máy không có camera thì mở trình chọn ảnh/camera của thiết bị.
function nkChupAnh(tieuDe, goiY) {
  return new Promise(res => {
    const khongCam = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment';
      i.onchange = async () => { try { res(i.files[0] ? await fileToDataUrl(i.files[0]) : null); } catch { nkKhongHoTro(); res(null); } }; i.click(); };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return khongCam();
    const moCam = async () => {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
      catch (e) {
        if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
          const q = modal(`<div class="notice"><div class="big cam-i">${NK_IC.camOff}</div><h3>Cho phép truy cập camera</h3><p class="muted">Hãy cấp quyền camera cho trình duyệt,<br>sau đó chọn “Thử lại”.</p>
            <div class="acts" style="justify-content:center"><button class="btn o" id="qh">Hủy</button><button class="btn" id="qt">Thử lại</button></div></div>`, 'narrow');
          $('#qh').onclick = () => { q.close(); res(null); }; $('#qt').onclick = () => { q.close(); moCam(); };
        } else khongCam();
        return;
      }
      const stop = () => stream.getTracks().forEach(t => t.stop());
      const m = modal(`<div class="cam-head"><b>${esc(tieuDe)}</b><button class="cam-x" id="cx">✕</button></div>
        <div class="cam-view"><video autoplay playsinline muted></video><div class="cam-frame"></div><span class="cam-hint">${esc(goiY)}</span></div>
        <div class="cam-foot"><button class="cam-shot" id="cs" aria-label="Chụp"></button></div>`, 'cam');
      const v = $('video', m.el); v.srcObject = stream;
      $('#cx').onclick = () => { stop(); m.close(); res(null); };
      $('#cs').onclick = () => {
        const c = document.createElement('canvas'), k = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        let q = 0.8, out = c.toDataURL('image/jpeg', q); while (out.length > 900e3 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        stop(); m.close();
        const ten = 'IMG_' + String(Date.now()).slice(-4) + '.jpg';
        const xem = modal(`<div class="cam-head"><b>Ảnh vừa chụp</b><button class="cam-x" data-close id="xx">✕</button></div>
          <div class="cam-view"><img src="${out}" alt=""><span class="cam-tag">${ten} · ${kichThuoc(out)}</span></div>
          <div class="cam-acts"><button class="btn o" id="cl">Chụp lại ảnh</button><button class="btn" id="cy">Xác nhận sử dụng ảnh</button></div>`, 'cam');
        $('#xx').onclick = () => res(null);
        $('#cl').onclick = () => { xem.close(); moCam(); };
        $('#cy').onclick = () => { xem.close(); res(out); };
      };
    };
    moCam();
  });
}

// Màn danh sách (UC 3.1 bước 3)
async function pageNhapKho() {
  const [rows, gan] = await Promise.all([api('GET', '/api/donhang?trangThai=DaDatHang&choNhap=1'), api('GET', '/api/phieunhap')]);
  const ttPN = r => r.trangThai === 'DaXacNhan' ? badge('DaXacNhan') : r.chuaCoLo > 0 ? '<span class="badge b-blue">Chưa nhập lô/HSD</span>'
    : r.trangThai === 'ChoXuLy' || r.soSaiLech > 0 ? '<span class="badge b-amber">Có sai lệch</span>' : badge('ChoXacNhan');
  shell(crumb('Nhập kho', 'Kiểm tra hàng nhập'), `${nkHead('Kiểm tra hàng nhập')}
  ${rows.length ? `<div class="nk-search"><input id="q" class="inp" placeholder="Tìm theo mã đơn đặt hàng"></div>` : ''}
  <div class="card"><div class="nk-chead"><h3>Đơn đặt hàng chờ nhập</h3>${rows.length ? '<span class="muted">Chọn đơn tương ứng với hàng vừa nhận</span>' : ''}</div><div id="ds"></div></div>
  ${gan.length ? `<div class="card"><h3>Phiếu nhập gần đây</h3>${table([['Mã phiếu', r => r.chuaCoLo > 0 && r.trangThai !== 'DaXacNhan' ? `<a href="#/nhapkho/lo/${r.maPhieuNhap}">${r.maPhieuNhap}</a>` : r.maPhieuNhap],
    ['Đơn đặt hàng', r => esc(r.maDonHang || '–')], ['Ngày nhập', r => fd(r.ngayNhap)], ['Người lập', r => esc(r.nguoiLap)], ['Trạng thái', ttPN]], gan)}</div>` : ''}`);
  const ve = list => $('#ds').innerHTML = !rows.length
    ? `<div class="nk-empty"><span>${NK_IC.box}</span><b>Không có đơn đặt hàng chờ nhập</b><p>Vui lòng báo quản lý tạo đơn đặt hàng trên hệ thống trước khi kiểm tra hàng.</p></div>`
    : table([['Mã đơn', r => `<b>${r.maDonHang}</b>`], ['Nhà cung cấp', r => esc(r.tenNCC)], ['Ngày đặt', r => fd(r.ngayDat)], ['Người đặt', r => esc(r.nguoiLap)], ['Số mặt hàng', r => r.soMatHang],
      ['Trạng thái', () => '<span class="badge b-blue">Chờ nhập</span>'], ['', r => `<button class="btn sm o nk-go" onclick="location.hash='#/nhapkho/${r.maDonHang}'">Kiểm tra hàng</button>`]], list, 'Không tìm thấy đơn đặt hàng phù hợp');
  ve(rows);
  if ($('#q')) $('#q').oninput = () => { const k = $('#q').value.trim().toUpperCase(); ve(rows.filter(r => r.maDonHang.toUpperCase().includes(k))); };
}

// Bước 1: Kiểm tra hàng nhập (UC 3.1)
async function pageNhapForm(maDon) {
  const d = await api('GET', '/api/donhang/' + maDon), st = nkState(maDon);
  const ngayNhan = fd(todayISO());
  shell(crumb('Nhập kho', 'Kiểm tra hàng nhập'), `${nkHead('Kiểm tra hàng nhập · ' + esc(d.maDonHang), st.xong ? '' : nkStepper(1))}
  <div class="card"><h3>Thông tin đơn đặt hàng</h3><div class="grid4 nk-info">
    <div><label class="f">Mã đơn</label><input class="inp" readonly value="${esc(d.maDonHang)}"></div><div><label class="f">Nhà cung cấp</label><input class="inp" readonly value="${esc(d.tenNCC)}"></div>
    <div><label class="f">Người đặt</label><input class="inp" readonly value="${esc(d.nguoiLap)} (Quản lý)"></div><div><label class="f">Ngày nhận</label><input class="inp" readonly value="${ngayNhan}"></div></div></div>
  <div class="card"><div class="nk-chead"><h3>Đối chiếu số lượng</h3><span class="muted">Đếm theo đơn vị ghi trên đơn đặt hàng</span></div><div id="nkWarn"></div>
    <table class="nk-tbl"><thead><tr><th style="width:60px">STT</th><th>Nguyên liệu</th><th>Đơn vị</th><th>SL đặt</th><th style="width:150px">SL thực nhận</th><th>Kết quả</th></tr></thead><tbody>
    ${d.chiTiet.map((c, i) => `<tr data-nl="${c.maNguyenLieu}" data-dat="${c.soLuongDat}"><td>${i + 1}</td><td>${esc(c.tenNguyenLieu)}</td><td>${esc(c.donViTinh)}</td><td>${c.soLuongDat}</td>
      <td><input class="inp sl" type="number" min="0" value="${st.sl[c.maNguyenLieu] ?? ''}"><div class="ferr"></div></td><td class="kq"></td></tr>`).join('')}</tbody></table></div>
  <div class="row end" id="nkActs"></div>`);
  if (st.xong) nkFlash('Kiểm tra hàng nhập hoàn tất', 'ok', true);
  const lech = tr => { const v = $('.sl', tr).value; return v === '' ? null : +v - +tr.dataset.dat; };
  const dv = tr => d.chiTiet.find(c => c.maNguyenLieu === tr.dataset.nl).donViTinh;
  const upd = tr => {
    const v = $('.sl', tr).value, l = lech(tr), kq = $('.kq', tr), nl = tr.dataset.nl, sai = st.saiLech[nl];
    tr.classList.remove('nk-lech');
    if (v === '' || !Number.isInteger(+v) || +v < 0) kq.innerHTML = '–';
    else if (l === 0 && !sai) kq.innerHTML = '<span class="badge b-green">Đủ</span>';
    else {
      const nhan = l < 0 ? `Thiếu ${-l} ${dv(tr)}` : l > 0 ? `Thừa ${l} ${dv(tr)}` : 'Sai lệch';
      if (sai) kq.innerHTML = `<span class="badge b-amber">${nhan} · đã ghi nhận</span>`;
      else { tr.classList.add('nk-lech'); kq.innerHTML = `<span class="badge b-amber">${nhan}</span> <button class="btn sm o" data-sl>Ghi nhận sai lệch</button>`; $('[data-sl]', kq).onclick = () => moSaiLech(nl); }
    }
    const chua = $$('tbody tr[data-nl]').filter(t => t.classList.contains('nk-lech')).length;
    $('#nkWarn').innerHTML = chua ? `<div class="nk-alert amber">Có ${chua} mặt hàng chênh lệch so với đơn đặt hàng. Hãy ghi nhận sai lệch trước khi xác nhận.</div>` : '';
  };
  const moSaiLech = nl => ghiNhanSaiLech({ d, chon: nl, items: d.chiTiet.filter(c => { const tr = $(`tr[data-nl="${c.maNguyenLieu}"]`); return lech(tr) || c.maNguyenLieu === nl; }),
    soLuong: c => Math.abs(lech($(`tr[data-nl="${c.maNguyenLieu}"]`)) || 0) || '' }, s => { st.saiLech[s.maNguyenLieu] = s; nkSave(maDon); $$('tbody tr[data-nl]').forEach(upd); nkFlash('Ghi nhận sai lệch thành công'); });
  const nut = () => $('#nkActs').innerHTML = st.xong
    ? `<button class="btn" id="tiep">Tiếp tục: Quét hóa đơn</button>`
    : `<button class="btn o" id="huy">Hủy</button><button class="btn" id="xn">Xác nhận số lượng thực nhận</button>`;
  nut();
  $$('tbody tr[data-nl]').forEach(tr => {
    const i = $('.sl', tr);
    i.oninput = () => { st.sl[tr.dataset.nl] = i.value; delete st.saiLech[tr.dataset.nl]; i.classList.remove('err'); $('.ferr', tr).textContent = '';
      if (st.xong) { st.xong = false; const r = $('#nkRight'); r._goc = undefined; r.innerHTML = nkStepper(1); nut(); bind(); } nkSave(maDon); upd(tr); };
    upd(tr);
  });
  const bind = () => {
    if ($('#tiep')) $('#tiep').onclick = () => location.hash = `#/nhapkho/${maDon}/hoadon`;
    if ($('#huy')) $('#huy').onclick = () => { nkClear(maDon); location.hash = '#/nhapkho'; };
    if ($('#xn')) $('#xn').onclick = () => {
      let ok = true;
      $$('tbody tr[data-nl]').forEach(tr => { const i = $('.sl', tr), e = $('.ferr', tr), v = i.value;
        if (v === '') { i.classList.add('err'); e.textContent = 'Bạn phải nhập số lượng thực nhận'; ok = false; }
        else if (!Number.isInteger(+v) || +v < 0) { i.classList.add('err'); e.textContent = 'Số lượng không hợp lệ'; ok = false; } });
      if (!ok) return;
      if ($$('tbody tr.nk-lech').length) { $('#nkWarn .nk-alert').classList.add('shake'); return; }
      st.xong = true; nkSave(maDon); const r = $('#nkRight'); r._goc = undefined; nkFlash('Kiểm tra hàng nhập hoàn tất', 'ok', true); nut(); bind();
    };
  };
  bind();
}
// UC 3.4 + 3.5: Ghi nhận sai lệch hàng nhập (form theo Figma, ảnh minh chứng chụp bằng camera)
function ghiNhanSaiLech({ d, chon, items, soLuong, lyDo, coDinh }, done) {
  const anh = [];
  const LD = [['GiaoThieu', 'Giao thiếu hàng'], ['GiaoSaiMatHang', 'Giao sai mặt hàng'], ['HuHong', 'Hư hỏng'], ['CanHanHetHan', 'Cận hạn/hết hạn']];
  const c0 = items.find(c => c.maNguyenLieu === chon);
  const m = modal(`<div class="nk-mhead"><div><h3>Ghi nhận sai lệch hàng nhập</h3><p class="muted">Đơn ${esc(d.maDonHang)} · Nhà cung cấp ${esc(d.tenNCC)}</p></div><button class="nk-x" data-close>✕</button></div><div id="serr"></div>
    <div class="grid2"><div><label class="f">Mặt hàng <i>*</i></label><select id="smh" class="inp" ${coDinh ? 'disabled' : ''}><option value="">Chọn mặt hàng</option>${items.map(c => `<option value="${c.maNguyenLieu}" ${c.maNguyenLieu === chon ? 'selected' : ''}>${esc(c.tenNguyenLieu)} (${esc(c.donViTinh)})</option>`).join('')}</select><div class="ferr" id="e_mh"></div></div>
      <div><label class="f">Số lượng sai lệch <i>*</i></label><input id="ssl" class="inp" type="number" min="1" placeholder="Nhập số lượng" value="${c0 ? soLuong(c0) : ''}"><div class="ferr" id="e_sl"></div></div></div>
    <label class="f" style="margin-top:14px">Lý do sai lệch <i>*</i></label><div class="nk-pills">${LD.map(([v, t]) => `<label class="nk-pill ${v === lyDo ? 'on' : ''}"><input type="radio" name="sld" value="${v}" ${v === lyDo ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div><div class="ferr" id="e_ld"></div>
    <label class="f" style="margin-top:14px">Ảnh minh chứng <i>*</i> <span class="muted">(chụp hoặc chọn ảnh, dưới 5 MB)</span></label>
    <div class="nk-anh" id="sanh"></div><div class="ferr nk-anh-err" id="e_anh"></div>
    <div class="acts nk-sep"><button class="btn o" data-close>Hủy</button><button class="btn" id="sok">Xác nhận ghi nhận</button></div>`, 'nkm');
  const veAnh = () => {
    $('#sanh').innerHTML = anh.map((a, i) => `<div class="nk-thumb"><img src="${a}" alt=""><span>Ảnh ${i + 1}</span><button data-rm="${i}" title="Xóa ảnh">✕</button></div>`).join('') +
      `<button type="button" class="nk-add" id="sadd">${NK_IC.cam}<span>Đính kèm ảnh</span></button>`;
    $('#sadd').onclick = dinhKem;
    $$('[data-rm]', m.el).forEach(b => b.onclick = () => { anh.splice(+b.dataset.rm, 1); veAnh(); });
  };
  const dinhKem = () => {
    const mh = items.find(c => c.maNguyenLieu === $('#smh').value), ld = $('input[name=sld]:checked', m.el);
    const sub = [mh && mh.tenNguyenLieu, ld && LD.find(x => x[0] === ld.value)[1]].filter(Boolean).join(' · ');
    const p = modal(`<h3>Đính kèm ảnh minh chứng</h3>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}
      <button type="button" class="nk-optc on" id="pc"><span class="nk-oic">${NK_IC.cam}</span><b>Chụp ảnh</b><small>Dùng camera để chụp tình trạng hàng hóa</small></button>
      <p class="muted" style="font-size:12px">Ảnh dưới 5 MB.</p><div class="acts"><button class="btn o" data-close>Hủy</button></div>`, 'narrow');
    $('#pc').onclick = async () => { p.close(); const a = await nkChupAnh('Chụp ảnh hàng lỗi', 'Đưa phần hàng lỗi vào giữa khung'); if (a) { anh.push(a); veAnh(); $('#e_anh').textContent = ''; $('#sanh').classList.remove('err'); } };
  };
  veAnh();
  $$('.nk-pill', m.el).forEach(l => l.onclick = () => { $$('.nk-pill', m.el).forEach(x => x.classList.remove('on')); l.classList.add('on'); $('input', l).checked = true; $('#e_ld').textContent = ''; });
  $('#smh').onchange = () => { const c = items.find(x => x.maNguyenLieu === $('#smh').value); if (c && soLuong(c)) $('#ssl').value = soLuong(c); };
  $('#sok').onclick = async () => {
    ['#e_mh', '#e_sl', '#e_ld', '#e_anh'].forEach(k => $(k).textContent = ''); $('#sanh').classList.remove('err'); $('#serr').innerHTML = '';
    const mh = $('#smh').value, sl = $('#ssl').value, ld = $('input[name=sld]:checked', m.el); let ok = true;
    if (!mh) { $('#e_mh').textContent = 'Không được để trống!'; ok = false; }
    if (sl === '') { $('#e_sl').textContent = 'Không được để trống!'; ok = false; } else if (!Number.isInteger(+sl) || +sl <= 0) { $('#e_sl').textContent = 'Số lượng không hợp lệ'; ok = false; }
    if (!ld) { $('#e_ld').textContent = 'Vui lòng chọn lý do sai lệch'; ok = false; }
    if (!anh.length) { $('#sanh').classList.add('err'); $('#e_anh').innerHTML = `${NK_IC.err} Vui lòng đính kèm ảnh minh chứng`; ok = false; }
    if (!ok) return;
    try { await done({ maNguyenLieu: mh, lyDo: ld.value, soLuongSaiLech: +sl, anh }); m.close(); }
    catch (e) { $('#serr').innerHTML = `<div class="nk-alert red">${NK_IC.err} ${esc(nkLoiMang(e) ? 'Kết nối không ổn định. Ảnh vừa chụp đang được giữ trên thiết bị, vui lòng thử lại.' : e.error || 'Có lỗi xảy ra, vui lòng thử lại!')}</div>`; }
  };
}

// Bước 2: Quét / tải hóa đơn (UC 3.2)
async function pageHoaDon(maDon) {
  const st = nkState(maDon); if (!st.xong) { location.hash = '#/nhapkho/' + maDon; return; }
  const d = await api('GET', '/api/donhang/' + maDon);
  const ve = () => {
    shell(crumb('Nhập kho', 'Quét hóa đơn'), `${nkHead('Quét hóa đơn · ' + esc(maDon), nkStepper(2))}${st.hoaDon ? `
    <div class="nk-hd"><div class="card"><h3>Ảnh hóa đơn</h3><div class="nk-hdimg"><img src="${st.hoaDon}" alt="Ảnh hóa đơn"></div><span class="badge b-green">Định dạng JPG · ${kichThuoc(st.hoaDon)}</span></div>
      <div class="card"><h3>Kết quả đọc hóa đơn</h3><p class="muted nk-note">Nhập số lượng ghi trên hóa đơn giấy để hệ thống đối chiếu với số lượng nhập kho.</p>
      <table class="nk-tbl"><thead><tr><th>Mặt hàng</th><th style="width:140px">Trên hóa đơn</th><th>Nhập kho</th><th>Đối chiếu</th></tr></thead><tbody>
      ${d.chiTiet.map(c => `<tr data-nl="${c.maNguyenLieu}"><td>${esc(c.tenNguyenLieu)}</td><td><div class="unit-inp sm"><input class="inp hdsl" type="number" min="0" value="${st.hd[c.maNguyenLieu] ?? c.soLuongDat}"><span>${esc(c.donViTinh)}</span></div></td>
        <td><b>${st.sl[c.maNguyenLieu]} ${esc(c.donViTinh)}</b></td><td class="dc"></td></tr>`).join('')}</tbody></table></div></div>
    <div class="row end" id="nkActs"><button class="btn o" id="ql">Quay lại</button><button class="btn" id="luu">Lưu chứng từ</button></div>` : `
    <div class="card"><h3>Chọn cách đưa hóa đơn lên hệ thống</h3><div class="nk-opts">
      <button type="button" class="nk-optc" id="oc"><span class="nk-oic">${NK_IC.cam}</span><b>Chụp ảnh</b><small>Dùng camera điện thoại để chụp hóa đơn giấy</small></button>
      <button type="button" class="nk-optc" id="ot"><span class="nk-oic">${NK_IC.up}</span><b>Tải từ thiết bị</b><small>Chọn ảnh hóa đơn có sẵn trong máy</small></button></div>
      <p class="muted" style="font-size:13px;margin:14px 0 0">Ảnh hóa đơn dung lượng dưới 5 MB.</p></div>`}`);
    const nhan = async a => { if (a) { st.hoaDon = a; nkSave(maDon); ve(); } };
    if ($('#oc')) { $('#oc').onclick = async () => nhan(await nkChupAnh('Chụp ảnh hóa đơn', 'Đặt hóa đơn nằm gọn trong khung')); $('#ot').onclick = async () => nhan(await nkChonFile()); return; }
    const doiChieu = tr => { const nl = tr.dataset.nl, c = d.chiTiet.find(x => x.maNguyenLieu === nl), hd = $('.hdsl', tr).value, nk = +st.sl[nl];
      st.hd[nl] = hd; const l = nk - +hd;
      $('.dc', tr).innerHTML = hd === '' ? '–' : l === 0 ? '<span class="badge b-green">Khớp</span>'
        : `<span class="badge b-amber">Lệch ${Math.abs(l)} ${esc(c.donViTinh)}${st.saiLech[nl] ? ' · đã ghi nhận' : ''}</span>`; };
    $$('tbody tr[data-nl]').forEach(tr => { doiChieu(tr); $('.hdsl', tr).oninput = () => { doiChieu(tr); nkSave(maDon); }; });
    $('#ql').onclick = () => { st.hoaDon = null; nkSave(maDon); ve(); };
    $('#luu').onclick = async () => {
      const b = $('#luu'); b.disabled = true;
      try {
        const r = await api('POST', '/api/phieunhap', { maDonHang: maDon, hinhAnhHoaDon: st.hoaDon, saiLech: Object.values(st.saiLech),
          chiTiet: d.chiTiet.map(c => ({ maNguyenLieu: c.maNguyenLieu, soLuongThucNhan: st.sl[c.maNguyenLieu], soLuongHoaDon: st.hd[c.maNguyenLieu] ?? c.soLuongDat })) });
        nkClear(maDon); $('.nk-net') && $('.nk-net').remove();
        nkFlash('Tạo phiếu nhập thành công', 'ok', true);
        $$('.hdsl').forEach(i => i.readOnly = true);
        $('#nkActs').innerHTML = `<button class="btn" id="tl">Tiếp tục: nhập lô/HSD</button>`; $('#tl').onclick = () => location.hash = '#/nhapkho/lo/' + r.maPhieuNhap;
      } catch (e) {
        if (nkLoiMang(e)) { nkNetBar('Kết nối không ổn định'); b.disabled = true; setTimeout(() => b.disabled = false, 3000); }
        else { b.disabled = false; nkFlash(e.error || 'Có lỗi xảy ra, vui lòng thử lại sau!', 'err'); }
      }
    };
  };
  ve();
}

// Bước 3: Lô hàng và hạn sử dụng (UC 3.3)
async function pageLoHang(maPN, chonMa) {
  const pn = await api('GET', '/api/phieunhap/' + maPN);
  const items = pn.chiTiet.filter(c => c.soLuongThucNhan > 0 || pn.saiLech.some(s => s.maNguyenLieu === c.maNguyenLieu && s.lyDo === 'CanHanHetHan'));
  const traLai = c => !(c.soLuongThucNhan > 0);
  const chua = items.filter(c => !c.soLo && !traLai(c));
  let chon = chonMa && items.find(c => c.maNguyenLieu === chonMa) || null;
  const xong = pn.trangThai === 'DaXacNhan';
  const nhanTT = c => traLai(c) ? '<span class="badge b-amber">Đã ghi nhận sai lệch</span>' : chon && c.maNguyenLieu === chon.maNguyenLieu ? (c._canDate ? '<span class="nk-tt amber">Cận date</span>' : '<span class="nk-tt blue">Đang nhập</span>')
    : c.soLo ? '<span class="badge b-green">Đã cập nhật</span>' : '<span class="badge b-gray">Chưa cập nhật</span>';
  shell(crumb('Nhập kho', 'Lô hàng/HSD'), `${nkHead('Lô hàng và hạn sử dụng · ' + esc(maPN), nkStepper(3))}
  <div class="nk-lo"><div class="card"><h3>Mặt hàng trong phiếu</h3><div id="lsMH"></div></div>
    <div><div class="card nk-lof" id="loF"></div><div id="loMsg"></div><div class="row end" id="nkActs"></div></div></div>`);
  const veDS = () => $('#lsMH').innerHTML = items.map(c => `<button type="button" class="nk-mh ${chon && c.maNguyenLieu === chon.maNguyenLieu ? 'on' : ''}" data-ma="${c.maNguyenLieu}" ${traLai(c) || xong ? 'disabled' : ''}>
    <b>${esc(c.tenNguyenLieu)}</b><span class="muted">${c.soLuongThucNhan} ${esc(c.donViTinh)}</span>${nhanTT(c)}</button>`).join('');
  const veForm = () => {
    veDS(); $$('.nk-mh', $('#lsMH')).forEach(b => b.onclick = () => { chon = items.find(c => c.maNguyenLieu === b.dataset.ma); veForm(); });
    $('#loMsg').innerHTML = ''; $('#nkActs').innerHTML = '';
    if (!chon) {
      $('#loF').innerHTML = chua.length
        ? `<div class="nk-empty sm"><span>${NK_IC.clip}</span><b>Chọn một mặt hàng để nhập số lô và hạn sử dụng</b><p>Phiếu nhập ${esc(maPN)} có ${chua.length} mặt hàng cần cập nhật.</p></div>`
        : `<div class="nk-empty sm"><span class="ok">${NK_IC.ok}</span><b>Đã cập nhật đủ lô hàng và hạn sử dụng</b><p>Phiếu nhập ${esc(maPN)} đang chờ quản lý xác nhận.</p></div>`;
      if (!chua.length) { $('#nkActs').innerHTML = '<button class="btn o" id="ve">Về danh sách nhập kho</button>'; $('#ve').onclick = () => location.hash = '#/nhapkho'; }
      return;
    }
    const c = chon;
    $('#loF').innerHTML = `<div class="nk-chead"><h3>${esc(c.tenNguyenLieu)}</h3><span id="conHan"></span></div>
      <div class="grid3"><div><label class="f">Số lô <i>*</i></label><input id="lso" class="inp" placeholder="VD: L2311" value="${esc(c.soLo || '')}"><div class="ferr" id="e_so"></div></div>
        <div><label class="f">Ngày sản xuất <i>*</i></label><input id="lnsx" class="inp" type="date" value="${c.ngaySanXuat || ''}"><div class="ferr" id="e_nsx"></div></div>
        <div><label class="f">Hạn sử dụng <i>*</i></label><input id="lhsd" class="inp" type="date" value="${c.hanSuDung || ''}"><div class="ferr" id="e_hsd"></div></div></div>
      <div style="width:calc((100% - 28px)/3);margin-top:14px"><label class="f">Số lượng nhập</label><input class="inp" readonly value="${c.soLuongThucNhan} ${esc(c.donViTinh)}"></div>`;
    const conLai = items.filter(x => !x.soLo && !traLai(x)).length, daCo = items.some(x => x.soLo);
    const kiemHan = () => {
      const h = $('#lhsd').value, nsx = $('#lnsx').value; c._canDate = false; $('#conHan').innerHTML = ''; $('#loMsg').innerHTML = daCo && conLai ? `<div class="nk-alert blue">Còn ${conLai} mặt hàng chưa cập nhật lô/HSD.</div>` : '';
      $('#nkActs').innerHTML = '<button class="btn" id="luu">Lưu</button>'; $('#luu').onclick = luu;
      if (!h || (nsx && h <= nsx)) return veDS();
      const n = Math.round((Date.parse(h) - Date.parse(todayISO())) / 864e5);
      if (n < 30) {
        c._canDate = true; $('#conHan').innerHTML = `<b class="nk-han">${n < 0 ? 'Đã hết hạn' : `Còn ${n} ngày đến hạn`}</b>`;
        $('#loMsg').innerHTML = `<div class="nk-candate"><span>${NK_IC.warn}</span><div><b>Hàng cận date/hết hạn</b><p>Lô ${esc($('#lso').value || '')} không đạt yêu cầu nhập kho. Hãy ghi nhận sai lệch, sau đó cập nhật các mặt hàng còn lại.</p></div><button class="btn o" id="gsl">Ghi nhận sai lệch</button></div>`;
        $('#nkActs').innerHTML = '';
        $('#gsl').onclick = () => ghiNhanSaiLech({ d: { maDonHang: pn.maDonHang, tenNCC: pn.tenNCC }, chon: c.maNguyenLieu, items: [c], soLuong: x => x.soLuongThucNhan, lyDo: 'CanHanHetHan', coDinh: true },
          async s => { await api('POST', `/api/phieunhap/${maPN}/sailech`, s); await pageLoHang(maPN); nkFlash('Ghi nhận sai lệch thành công'); });
      }
      veDS();
    };
    const luu = async () => {
      ['#e_so', '#e_nsx', '#e_hsd'].forEach(k => $(k).textContent = ''); ['#lso', '#lnsx', '#lhsd'].forEach(k => $(k).classList.remove('err')); $('#loMsg').innerHTML = '';
      const so = $('#lso').value.trim(), nsx = $('#lnsx').value, hsd = $('#lhsd').value; let ok = true;
      const loi = (i, e, t) => { $(i).classList.add('err'); $(e).textContent = t; ok = false; };
      if (!so) loi('#lso', '#e_so', 'Không được để trống!');
      if (!nsx) loi('#lnsx', '#e_nsx', 'Không được để trống!'); else if (nsx > todayISO()) loi('#lnsx', '#e_nsx', 'NSX sau ngày hiện tại');
      if (!hsd) loi('#lhsd', '#e_hsd', 'Không được để trống!'); else if (nsx && hsd <= nsx) loi('#lhsd', '#e_hsd', 'HSD phải sau NSX');
      if (!ok) { if (so && nsx && hsd) $('#loMsg').innerHTML = `<div class="nk-alert red">${NK_IC.err} Thông tin lô hàng hoặc hạn sử dụng không hợp lệ</div>`; return; }
      try {
        await api('POST', `/api/phieunhap/${maPN}/lo`, { maNguyenLieu: c.maNguyenLieu, soLo: so, ngaySanXuat: nsx, hanSuDung: hsd });
        Object.assign(c, { soLo: so, ngaySanXuat: nsx, hanSuDung: hsd });
        const i = chua.indexOf(c); if (i >= 0) chua.splice(i, 1);
        chon = chua[0] || null; veForm(); nkFlash('Lưu thành công');
      } catch (e) {
        if (e.canDate) return kiemHan();
        if (nkLoiMang(e)) nkNetBar('Kết nối không ổn định'); else $('#loMsg').innerHTML = `<div class="nk-alert red">${NK_IC.err} ${esc(e.error || 'Có lỗi xảy ra, vui lòng thử lại!')}</div>`;
      }
    };
    ['#lhsd', '#lnsx'].forEach(k => { $(k).addEventListener('change', kiemHan); $(k).addEventListener('input', kiemHan); });
    [['#lso', '#e_so'], ['#lnsx', '#e_nsx'], ['#lhsd', '#e_hsd']].forEach(([i, e]) => $(i).addEventListener('input', () => { $(i).classList.remove('err'); $(e).textContent = ''; }));
    kiemHan();
  };
  veForm();
}

/* ---------- UC 4: Xuất kho ---------- */
async function pageXuatKho() {
  const rows = await api('GET', '/api/phieuxuat');
  shell(crumb('Xuất kho'), `<div class="row"><h2 class="title grow">Xuất kho</h2><button class="btn" onclick="location.hash='#/xuatkho/tao'">+ Tạo phiếu xuất kho</button></div><br>
  <div class="card"><h3>Danh sách phiếu xuất kho</h3>${table([['Mã phiếu', r => `<b>${r.maPhieuXuat}</b>`], ['Ngày tạo', r => fd(r.ngayXuat)], ['Người lập', r => esc(r.nguoiLap)], ['Lý do xuất', r => esc(r.lyDoXuat)], ['Số mặt hàng', r => r.soMatHang], ['Trạng thái', r => badge(r.trangThai)]], rows, 'Chưa có phiếu xuất')}</div>`);
}
async function pageXuatForm() {
  const [nls, ds] = await Promise.all([api('GET', '/api/nguyenlieu'), api('GET', '/api/phieuxuat')]); const items = [];
  const soMax = ds.reduce((m, r) => Math.max(m, parseInt(String(r.maPhieuXuat).slice(3), 10) || 0), 0);
  const maDuKien = 'PX-' + String(soMax + 1).padStart(4, '0');
  shell(crumb('Xuất kho', 'Tạo phiếu xuất kho'), `<h2 class="title">Tạo phiếu xuất kho</h2><br><div id="ferr"></div>
  <div class="card"><h3>Thông tin phiếu</h3><div class="grid4"><div><label class="f">Mã phiếu</label><input class="inp" readonly value="${maDuKien}"></div>
    <div><label class="f">Ngày tạo</label><input class="inp" readonly value="${fd(todayISO())}"></div>
    <div><label class="f">Người lập</label><input class="inp" readonly value="${esc(S.me.hoTen)}"></div>
    <div><label class="f">Lý do xuất <i>*</i></label><select id="ld" class="inp"><option value="">Chọn lý do xuất</option><option>Ca bán hàng</option><option>Xuất hủy (hết hạn / hư hỏng)</option><option>Dùng nội bộ / mẫu thử</option></select><div class="ferr" id="e0"></div></div></div></div>
  <div class="card"><h3>Nguyên liệu cần xuất</h3><div class="row" style="align-items:flex-start">
    <div class="grow"><label class="f">Tìm kiếm nguyên liệu</label><input id="tim" class="inp" autocomplete="off" placeholder="Nhập tên nguyên liệu"><div class="ferr" id="e1"></div><div class="hint" id="h1"></div></div>
    <div style="width:220px"><label class="f">Số lượng</label><div class="unit-inp"><input id="sl" class="inp" type="number" min="1" placeholder="Nhập số lượng"><span id="dv"></span></div><div class="ferr" id="e2"></div></div>
    <button class="btn o" id="them" style="margin-top:20px">+ Thêm nguyên liệu</button></div></div>
  <div class="card" id="bang"></div>
  <div class="row end"><button class="btn o" onclick="location.hash='#/xuatkho'">Hủy</button><button class="btn" id="ok">Xác nhận</button></div>`);
  const draw = () => $('#bang').innerHTML = table([['STT', (r) => items.indexOf(r) + 1], ['Tên nguyên liệu', r => esc(r.ten)], ['Đơn vị', r => esc(r.dvt)], ['Số lượng xuất', r => r.soLuong], ['', r => `<button class="btn sm o red" data-rm="${r.maNguyenLieu}">Bỏ</button>`]], items, 'Chưa có nguyên liệu nào trong phiếu');
  $('#bang').onclick = e => { const m = e.target.dataset.rm; if (m) { items.splice(items.findIndex(i => i.maNguyenLieu === m), 1); draw(); } };
  draw();
  const timNL = () => nls.find(x => x.tenNguyenLieu.toLowerCase() === $('#tim').value.trim().toLowerCase());
  const capNhatGoiY = () => { const n = timNL(); $('#h1').textContent = n ? `Tồn kho khả dụng: ${n.soLuongTon} ${n.donViTinh}` : ''; $('#dv').textContent = n ? n.donViTinh : ''; };
  goiY($('#tim'), () => nls.map(n => ({ v: n.tenNguyenLieu, sub: `Tồn: ${n.soLuongTon} ${n.donViTinh}` })), capNhatGoiY);
  $('#tim').addEventListener('input', () => { $('#e1').textContent = ''; capNhatGoiY(); });
  $('#them').onclick = () => {
    const ten = $('#tim').value.trim(), sl = $('#sl').value; $('#e1').textContent = $('#e2').textContent = '';
    $('#tim').classList.remove('err'); $('#sl').classList.remove('err');
    const loi = (o, e, t) => { $(e).textContent = t; $(o).classList.add('err'); };
    if (!ten) return loi('#tim', '#e1', 'Không được để trống!');
    const n = timNL(); if (!n) return loi('#tim', '#e1', 'Tên nguyên liệu không tồn tại, vui lòng kiểm tra lại!');
    if (sl === '') return loi('#sl', '#e2', 'Không được để trống!');
    if (!(+sl > 0) || !Number.isInteger(+sl)) return loi('#sl', '#e2', 'Số lượng xuất phải lớn hơn 0!');
    const ex = items.find(i => i.maNguyenLieu === n.maNguyenLieu); if (ex) ex.soLuong += +sl; else items.push({ maNguyenLieu: n.maNguyenLieu, ten: n.tenNguyenLieu, dvt: n.donViTinh, soLuong: +sl });
    $('#tim').value = $('#sl').value = ''; capNhatGoiY(); draw(); toast('Đã thêm nguyên liệu thành công!');
  };
  const gui = async (phuongAn, thucXuat) => {
    try {
      const r = await api('POST', '/api/phieuxuat', { lyDoXuat: $('#ld').value, chiTiet: items.map(i => ({ maNguyenLieu: i.maNguyenLieu, soLuong: i.soLuong })), phuongAn, thucXuat });
      if (r.choBoSung) notice('warn', 'Đã ghi nhận chờ bổ sung hàng', `Phiếu ${r.maPhieuXuat} chưa được xuất kho.`);
      else notice('ok', 'Tạo phiếu xuất kho thành công!', `Phiếu ${r.maPhieuXuat} đã được lưu, chờ quản lý xác nhận.`);
      location.hash = '#/xuatkho';
    } catch (e) {
      if (e.status === 409 && e.thieu) return thieuHang(e.thieu, items, nls, gui);
      $('#ferr').innerHTML = `<div class="alert red">! ${esc(e.error)}</div>`;
    }
  };
  $('#ok').onclick = () => {
    $('#e0').textContent = ''; $('#ferr').innerHTML = '';
    if (!$('#ld').value) { $('#e0').textContent = 'Không được để trống!'; return; }
    gui();
  };
}
function thieuHang(thieu, items, nls, gui) {
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
    // UC 4.2 (Figma): bảng gồm mọi nguyên liệu trong phiếu, cột "Thực xuất" cho phép chỉnh sửa
    const rows = items.map(i => { const n = nls.find(x => x.maNguyenLieu === i.maNguyenLieu) || {}, t = thieu.find(x => x.maNguyenLieu === i.maNguyenLieu);
      const ton = t ? t.ton : n.soLuongTon; return { ma: i.maNguyenLieu, ten: i.ten, dvt: i.dvt, yeuCau: i.soLuong, ton, max: Math.min(i.soLuong, ton) }; });
    const c = modal(`<h3>Xác nhận số lượng thực tế sẽ xuất</h3><p class="muted">Hệ thống chỉ xuất theo số lượng còn khả dụng hiện có. Vui lòng kiểm tra lại số lượng.</p>
      <table class="tbl"><thead><tr><th>Nguyên liệu</th><th>Yêu cầu</th><th>Tồn kho</th><th style="width:150px">Thực xuất</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.ten)}</td><td>${r.yeuCau} ${esc(r.dvt)}</td><td>${r.ton} ${esc(r.dvt)}</td>
        <td><div class="unit-inp sm"><input class="inp tx" type="number" min="1" max="${r.max}" data-ma="${esc(r.ma)}" value="${r.max}"><span>${esc(r.dvt)}</span></div><div class="ferr" data-e="${esc(r.ma)}"></div></td></tr>`).join('')}</tbody></table>
      <label class="opt" style="margin-top:14px"><input type="checkbox" id="cf"><span>Tôi xác nhận số lượng thực tế sẽ xuất ở trên</span></label>
      <div class="acts"><button class="btn o" data-close>Quay lại</button><button class="btn" id="cfok" disabled>Xác nhận số lượng</button></div>`, 'wide');
    $('#cf').onchange = e => $('#cfok').disabled = !e.target.checked;
    $('#cfok').onclick = () => {
      const thucXuat = {}; let ok = true;
      $$('.tx', c.el).forEach(inp => {
        const r = rows.find(x => x.ma === inp.dataset.ma), v = inp.value, e = $(`[data-e="${CSS.escape(r.ma)}"]`, c.el);
        e.textContent = ''; inp.classList.remove('err');
        const loi = t => { e.textContent = t; inp.classList.add('err'); ok = false; };
        if (v === '') loi('Không được để trống!');
        else if (!Number.isInteger(+v) || +v <= 0) loi('Số lượng phải lớn hơn 0!');
        else if (+v > r.max) loi(`Tối đa ${r.max} ${r.dvt}`);
        else thucXuat[r.ma] = +v;
      });
      if (!ok) return;
      c.close(); gui('LayConLai', thucXuat);
    };
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
/* ---------- UC 7: Đơn đặt hàng & nhà cung cấp – bám Figma ---------- */
const fmtSdt = s => String(s || '').replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
const tenFile = (d, duoi) => `DonDatHang_${d.maDonHang.replace('-', '')}_${boDau(d.tenNCC).split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('').replace(/[^A-Za-z0-9]/g, '')}.${duoi}`;
function ttLoi(tieuDe, noiDung) {
  modal(`<div class="notice n-err"><div class="big err-i">${NK_IC.err}</div><h3>${tieuDe}</h3><p class="muted">${noiDung}</p><div class="acts"><button class="btn o" data-close>Đóng</button></div></div>`, 'narrow');
}
async function pageDonHang() {
  const rows = await api('GET', '/api/donhang');
  shell(crumb('Nhà cung cấp', 'Đơn đặt hàng'), `${nkHead('Danh sách đơn đặt hàng', `<button class="btn" onclick="location.hash='#/donhang/tao'">+ Tạo đơn đặt hàng</button>`)}<p class="sub-t dh-sub">Mỗi đơn gửi cho một nhà cung cấp</p>
  <div class="card"><h3>Danh sách đơn</h3>${table([['Mã đơn', r => `<b>${r.maDonHang}</b>`], ['Nhà cung cấp', r => esc(r.tenNCC)], ['Ngày tạo', r => fd(r.ngayDat)], ['Số mặt hàng', r => r.soMatHang + ' mặt hàng'], ['Trạng thái', r => badge(r.trangThai)],
    ['', r => `<button class="btn sm o" onclick="location.hash='#/donhang/${r.maDonHang}'">Xem chi tiết</button>`]], rows, 'Chưa có đơn đặt hàng')}</div>`);
}
const DH_NHAP = {}; // đơn đang soạn (để quay lại từ màn Kiểm tra đơn)
async function pageDonForm(maSua, xemLai) {
  const [nccs, nls, dx] = await Promise.all([api('GET', '/api/ncc'), api('GET', '/api/nguyenlieu'), api('GET', '/api/dexuat')]);
  const don = maSua ? await api('GET', '/api/donhang/' + maSua) : null;
  const st = maSua ? { ncc: don.maNCC, items: don.chiTiet.map(c => ({ ma: c.maNguyenLieu, sl: c.soLuongDat })) } : (DH_NHAP.st || { ncc: '', items: dx.map(x => ({ ma: x.maNguyenLieu, sl: x.soLuongDeXuat })) });
  if (!maSua) DH_NHAP.st = st;
  const nl = ma => nls.find(n => n.maNguyenLieu === ma) || {};
  const ncc = () => nccs.find(n => n.maNCC === st.ncc);
  const deXuat = n => Math.max(0, (n.mucToiDa || 5) - (n.soLuongTon || 0));
  const ngay = don ? fd(don.ngayDat) : fd(todayISO());
  if (xemLai) { // Màn "Kiểm tra đơn đặt hàng" (UC 7.1)
    const n = ncc();
    shell(crumb('Nhà cung cấp', 'Đơn đặt hàng', 'Tạo đơn đặt hàng'), `${nkHead('Kiểm tra đơn đặt hàng')}<p class="sub-t dh-sub">Xem lại thông tin trước khi xác nhận</p><div id="ferr"></div>
    <div class="card"><h3>Thông tin đơn</h3><div class="grid4"><div><label class="f">Nhà cung cấp</label><input class="inp" readonly value="${esc(n.tenNCC)}"></div><div><label class="f">Số điện thoại</label><input class="inp" readonly value="${fmtSdt(n.soDienThoai)}"></div>
      <div><label class="f">Ngày tạo</label><input class="inp" readonly value="${ngay}"></div><div><label class="f">Người lập</label><input class="inp" readonly value="${esc(S.me.hoTen)}"></div></div></div>
    <div class="card"><h3>Nguyên vật liệu cần đặt</h3>${table([['Nguyên vật liệu', r => `<b>${esc(nl(r.ma).tenNguyenLieu)}</b>`], ['Đơn vị', r => esc(nl(r.ma).donViTinh)], ['Tồn hiện tại', r => `<span class="${nl(r.ma).duoiMuc ? 'red-t' : ''}">${nl(r.ma).soLuongTon}</span>`], ['Đề xuất', r => deXuat(nl(r.ma))], ['Số lượng đặt', r => `<b>${r.sl}</b>`]], st.items)}</div>
    <div class="row end"><button class="btn o" id="huy">Hủy</button><button class="btn o" id="sua">Chỉnh sửa</button><button class="btn" id="ok">Xác nhận đơn đặt hàng</button></div>`);
    $('#huy').onclick = () => { delete DH_NHAP.st; location.hash = '#/donhang'; };
    $('#sua').onclick = () => pageDonForm();
    $('#ok').onclick = async () => {
      try { const r = await api('POST', '/api/donhang', { maNCC: st.ncc, chiTiet: st.items.map(i => ({ maNguyenLieu: i.ma, soLuongDat: +i.sl })) });
        delete DH_NHAP.st; DH_NHAP.flash = 'Đã lưu đơn đặt hàng ' + r.maDonHang; location.hash = '#/donhang/' + r.maDonHang; }
      catch (e) { $('#ferr').innerHTML = `<div class="nk-alert red">${NK_IC.err} ${esc(e.error || 'Có lỗi xảy ra, vui lòng thử lại!')}</div>`; }
    };
    return;
  }
  shell(crumb('Nhà cung cấp', 'Đơn đặt hàng', ...(maSua ? [maSua, 'Chỉnh sửa'] : ['Tạo đơn đặt hàng'])), `${nkHead(maSua ? 'Chỉnh sửa đơn đặt hàng' : 'Tạo đơn đặt hàng')}
  <p class="sub-t dh-sub">${maSua ? 'Chỉ sửa số lượng hoặc thêm, bỏ nguyên vật liệu' : 'Chọn một nhà cung cấp, sau đó chọn nguyên vật liệu và số lượng cần đặt'}</p><div id="ferr"></div>
  <div class="card"><h3>Thông tin đơn</h3>${maSua
    ? `<div class="grid2"><div><label class="f">Nhà cung cấp</label><input class="inp" readonly value="${esc(don.tenNCC)}"></div><div><label class="f">Mã đơn</label><input class="inp" readonly value="${maSua}"></div></div><p class="muted" style="font-size:12px;margin:10px 0 0">Không đổi nhà cung cấp khi chỉnh sửa đơn</p>`
    : `<div class="grid3"><div><label class="f">Nhà cung cấp <i>*</i></label><select id="ncc" class="inp"><option value="">Chọn nhà cung cấp</option>${nccs.map(n => `<option value="${n.maNCC}" data-sub="${fmtSdt(n.soDienThoai)}" ${st.ncc === n.maNCC ? 'selected' : ''}>${esc(n.tenNCC)}</option>`).join('')}</select><div class="ferr" id="enc"></div></div>
      <div><label class="f">Ngày tạo</label><input class="inp" readonly value="${ngay}"></div><div><label class="f">Người lập</label><input class="inp" readonly value="${esc(S.me.hoTen)}"></div></div>`}</div>
  <div class="card"><h3>Nguyên vật liệu cần đặt</h3><div id="bang"></div></div>
  <div class="row end"><button class="btn o" id="huy">Hủy</button><button class="btn" id="ok">${maSua ? 'Cập nhật đơn hàng' : 'Kiểm tra đơn'}</button></div>`);
  const draw = () => {
    if (!maSua && !st.ncc) { $('#bang').innerHTML = `<div class="dh-empty"><p>Chọn nhà cung cấp trước khi thêm nguyên vật liệu</p><span>+ Thêm nguyên vật liệu</span></div>`; return; }
    $('#bang').innerHTML = table([['Nguyên vật liệu', r => `<b>${esc(nl(r.ma).tenNguyenLieu)}</b>`], ['Đơn vị', r => esc(nl(r.ma).donViTinh)], ['Tồn hiện tại', r => `<span class="${nl(r.ma).duoiMuc ? 'red-t' : ''}">${nl(r.ma).soLuongTon}</span>`],
      ['Đề xuất', r => deXuat(nl(r.ma))], ['Số lượng đặt', r => `<input class="inp dh-sl" type="number" min="1" data-sl="${r.ma}" value="${r.sl}"><div class="ferr" data-e="${r.ma}"></div>`],
      ['', r => `<button class="btn link dh-bo" data-rm="${r.ma}">Bỏ</button>`]], st.items, 'Chưa có nguyên vật liệu') +
      `<div class="dh-addw"><button type="button" class="dh-add" id="addnl">+ Thêm nguyên vật liệu</button><div class="dd-panel" id="addp"></div></div>`;
    $$('[data-sl]').forEach(i => i.oninput = () => { st.items.find(x => x.ma === i.dataset.sl).sl = i.value; i.classList.remove('err'); $(`[data-e="${i.dataset.sl}"]`).textContent = ''; });
    $$('[data-rm]').forEach(b => b.onclick = () => { st.items.splice(st.items.findIndex(x => x.ma === b.dataset.rm), 1); draw(); });
    const w = $('.dh-addw'), pn = $('#addp');
    $('#addnl').onclick = () => {
      const con = nls.filter(n => !st.items.find(x => x.ma === n.maNguyenLieu));
      pn.innerHTML = con.length ? con.map(n => `<div class="dd-it dh-it" data-ma="${n.maNguyenLieu}"><span>${esc(n.tenNguyenLieu)}</span><small>Tồn: ${n.soLuongTon} ${esc(n.donViTinh)}</small></div>`).join('') : '<div class="gy-none">Đã thêm tất cả nguyên vật liệu</div>';
      w.classList.toggle('open');
      const out = e => { if (!w.contains(e.target)) { w.classList.remove('open'); document.removeEventListener('mousedown', out); } }; document.addEventListener('mousedown', out);
    };
    pn.onclick = e => { const it = e.target.closest('[data-ma]'); if (!it) return; const n = nl(it.dataset.ma); st.items.push({ ma: it.dataset.ma, sl: deXuat(n) || 1 }); draw(); };
  };
  draw();
  if ($('#ncc')) $('#ncc').onchange = () => { st.ncc = $('#ncc').value; $('#enc').textContent = ''; $('#ncc').classList.remove('err'); $('#ncc')._dd && $('#ncc')._dd(); $('#ferr').innerHTML = ''; draw(); };
  $('#huy').onclick = () => { delete DH_NHAP.st; location.hash = maSua ? '#/donhang/' + maSua : '#/donhang'; };
  $('#ok').onclick = async () => {
    $('#ferr').innerHTML = ''; $$('[data-e]').forEach(x => x.textContent = '');
    const banner = t => $('#ferr').innerHTML = `<div class="nk-alert red">${NK_IC.err} ${t}</div>`;
    if (!maSua && !st.ncc) { $('#enc').textContent = 'Vui lòng chọn nhà cung cấp'; $('#ncc').classList.add('err'); $('#ncc')._dd(); return banner('Vui lòng chọn nhà cung cấp'); }
    if (!st.items.length) return banner('Vui lòng thêm ít nhất một nguyên vật liệu');
    const bad = st.items.filter(i => !(+i.sl > 0) || !Number.isInteger(+i.sl));
    if (bad.length) { bad.forEach(b => { $(`[data-e="${b.ma}"]`).textContent = 'Số lượng phải lớn hơn 0'; $(`[data-sl="${b.ma}"]`).classList.add('err'); }); return banner('Số lượng không hợp lệ'); }
    if (!maSua) return pageDonForm(undefined, true);
    try { await api('PUT', '/api/donhang/' + maSua, { chiTiet: st.items.map(i => ({ maNguyenLieu: i.ma, soLuongDat: +i.sl })) });
      DH_NHAP.flash = 'Cập nhật đơn đặt hàng thành công'; location.hash = '#/donhang/' + maSua; }
    catch (e) { banner(esc(e.error || 'Có lỗi xảy ra, vui lòng thử lại!')); }
  };
}
async function pageDonChiTiet(ma) {
  const [d, nls] = await Promise.all([api('GET', '/api/donhang/' + ma), api('GET', '/api/nguyenlieu')]);
  const nl = m => nls.find(n => n.maNguyenLieu === m) || {};
  let file = null; try { file = localStorage.getItem('dhFile:' + ma); } catch { }
  shell(crumb('Nhà cung cấp', 'Đơn đặt hàng', ma), `${nkHead(`Đơn đặt hàng ${ma} <span class="dh-badge">${badge(d.trangThai)}</span>`)}<p class="sub-t dh-sub">Nhà cung cấp: ${esc(d.tenNCC)}</p>
  <div class="card"><h3>Thông tin đơn</h3><div class="grid4"><div><label class="f">Nhà cung cấp</label><input class="inp" readonly value="${esc(d.tenNCC)}"></div><div><label class="f">Số điện thoại</label><input class="inp" readonly value="${fmtSdt(d.sdtNCC)}"></div>
    <div><label class="f">Ngày tạo</label><input class="inp" readonly value="${fd(d.ngayDat)}"></div><div><label class="f">Người lập</label><input class="inp" readonly value="${esc(d.nguoiLap)}"></div></div></div>
  <div class="card"><h3>Nguyên vật liệu cần đặt</h3>${table([['Nguyên vật liệu', r => `<b>${esc(r.tenNguyenLieu)}</b>`], ['Đơn vị', r => esc(r.donViTinh)], ['Tồn hiện tại', r => `<span class="${nl(r.maNguyenLieu).duoiMuc ? 'red-t' : ''}">${r.soLuongTon}</span>`],
    ['Đề xuất', r => Math.max(0, (nl(r.maNguyenLieu).mucToiDa || 5) - r.soLuongTon)], ['Số lượng đặt', r => `<b>${r.soLuongDat}</b>`]], d.chiTiet)}</div>
  <div class="row dh-foot noprint">${file ? `<span class="dh-file"><i>${/\.pdf$/.test(file) ? 'PDF' : 'XLS'}</i>${esc(file)}</span>` : ''}<span class="grow"></span>
    ${d.trangThai === 'ChoDatHang' ? `<button class="btn o" onclick="location.hash='#/donhang/${ma}/sua'">Chỉnh sửa</button><button class="btn" id="xuat">Xuất đơn đặt hàng</button>` : `<button class="btn o" onclick="location.hash='#/donhang'">Quay lại</button><button class="btn o" id="xuat">Tải lại file</button>`}</div>`);
  if (DH_NHAP.flash) { nkFlash(DH_NHAP.flash); delete DH_NHAP.flash; }
  $('#xuat').onclick = () => {
    let dang = 'pdf';
    const m = modal(`<h3>Xuất đơn đặt hàng ${ma}</h3><p class="muted dh-msub">Hệ thống tạo file, bạn gửi cho nhà cung cấp qua Zalo hoặc email</p><label class="f">Định dạng file</label>
      <label class="dh-fmt on" data-f="pdf"><input type="radio" name="fmt" checked><span><b>PDF</b><small>Giữ nguyên định dạng, xem trên điện thoại</small></span></label>
      <label class="dh-fmt" data-f="csv"><input type="radio" name="fmt"><span><b>Excel</b><small>Mở bằng Excel để chỉnh sửa</small></span></label>
      <label class="dh-chk"><input type="checkbox" id="gm" checked> Gửi bản sao về Gmail của tôi</label><div id="kq"></div>
      <div class="acts" id="ma"><button class="btn o" data-close>Hủy</button><button class="btn" id="tao">Tạo file</button></div>`);
    $$('.dh-fmt', m.el).forEach(l => l.onclick = () => { $$('.dh-fmt', m.el).forEach(x => x.classList.remove('on')); l.classList.add('on'); $('input', l).checked = true; dang = l.dataset.f; });
    $('#tao').onclick = () => {
      const ten = tenFile(d, dang);
      if (dang === 'csv') csv(ten, ['Mã đơn', 'Nhà cung cấp', 'Nguyên vật liệu', 'Đơn vị', 'Số lượng đặt'], d.chiTiet.map(c => [ma, d.tenNCC, c.tenNguyenLieu, c.donViTinh, c.soLuongDat]));
      else inDonPDF(d, ten);
      if ($('#gm').checked) {
        const noiDung = `Bản sao đơn đặt hàng ${ma} gửi ${d.tenNCC} (ngày ${fd(d.ngayDat)}):\n` + d.chiTiet.map(c => `- ${c.tenNguyenLieu}: ${c.soLuongDat} ${c.donViTinh}`).join('\n') + `\n\nFile: ${ten}`;
        window.open('https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(`[WinKids] Bản sao đơn đặt hàng ${ma}`) + '&body=' + encodeURIComponent(noiDung), '_blank');
      }
      try { localStorage.setItem('dhFile:' + ma, ten); } catch { }
      if (d.trangThai !== 'ChoDatHang') { m.close(); return pageDonChiTiet(ma).then(() => nkFlash('Đã tạo file ' + ten)); }
      $('#kq').innerHTML = `<div class="dh-ok"><b>Đã tạo file ${esc(ten)}</b><span>Gửi file cho ${esc(d.tenNCC)} rồi bấm “Đã gửi cho NCC”.</span></div>`;
      $('#ma').innerHTML = `<button class="btn o" id="sau">Để sau</button><button class="btn dh-green" id="dagui">Đã gửi cho NCC</button>`;
      $('#sau').onclick = () => { m.close(); pageDonChiTiet(ma); };
      $('#dagui').onclick = async () => {
        try { await api('POST', `/api/donhang/${ma}/dadat`); m.close(); DH_NHAP.flash = 'Đặt hàng thành công'; pageDonChiTiet(ma); }
        catch (e) { m.close(); ttLoi('Có lỗi xảy ra', esc(e.error || 'Hệ thống chưa cập nhật được đơn hàng.')); }
      };
    };
  };
}
function inDonPDF(d, ten) {
  const w = window.open('', '_blank'); if (!w) return toast('Trình duyệt đã chặn cửa sổ in, vui lòng cho phép cửa sổ bật lên', 1);
  w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${ten.replace(/\.pdf$/, '')}</title><style>body{font-family:Arial,sans-serif;color:#1B2A41;padding:32px}h1{font-size:22px;margin:0 0 4px}p{margin:2px 0;color:#5B6576}
    table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #D7DCE3;padding:8px 10px;text-align:left}th{background:#FDE7C8}.r{text-align:right}</style></head><body>
    <h1>ĐƠN ĐẶT HÀNG ${d.maDonHang}</h1><p>WinKids – Khu vui chơi &amp; cà phê</p><br><p><b>Nhà cung cấp:</b> ${esc(d.tenNCC)} · ${fmtSdt(d.sdtNCC)}</p><p><b>Ngày tạo:</b> ${fd(d.ngayDat)} · <b>Người lập:</b> ${esc(d.nguoiLap)}</p>
    <table><thead><tr><th>STT</th><th>Nguyên vật liệu</th><th>Đơn vị</th><th class="r">Số lượng đặt</th></tr></thead><tbody>${d.chiTiet.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.tenNguyenLieu)}</td><td>${esc(c.donViTinh)}</td><td class="r">${c.soLuongDat}</td></tr>`).join('')}</tbody></table>
    <script>onload=()=>setTimeout(()=>print(),200)<\/script></body></html>`);
  w.document.close();
}
// UC 7.2 – 7.4: Nhà cung cấp
async function pageNCC(mode, maSua) {
  const rows = await api('GET', '/api/ncc');
  const nhan = { them: 'Thêm NCC', sua: 'Sửa NCC', xoa: 'Xóa NCC', ds: 'Danh sách' }[mode];
  // Biểu mẫu thêm / sửa (trang riêng theo Figma)
  if (mode === 'them' || (mode === 'sua' && maSua)) {
    const n = maSua ? rows.find(r => r.maNCC === maSua) : null;
    if (maSua && !n) { location.hash = '#/ncc/sua'; return; }
    shell(crumb('Nhà cung cấp', nhan, ...(n ? [n.tenNCC] : [])), `${nkHead(n ? 'Sửa thông tin nhà cung cấp' : 'Thêm nhà cung cấp')}
    <div class="card ncc-form"><h3>Thông tin nhà cung cấp</h3><div id="me"></div>
      <div class="field"><label class="f">Tên nhà cung cấp <i>*</i></label><input id="t" class="inp" value="${esc(n?.tenNCC)}" placeholder="Nhập tên nhà cung cấp"><div class="ferr" id="et"></div></div>
      <div class="field"><label class="f">Số điện thoại <i>*</i></label><input id="s" class="inp" inputmode="tel" value="${fmtSdt(n?.soDienThoai)}" placeholder="VD: 0905 123 456"><div class="ferr" id="es"></div></div>
      <div class="field"><label class="f">Địa chỉ</label><input id="d" class="inp" value="${esc(n?.diaChi)}" placeholder="Nhập địa chỉ (không bắt buộc)"></div>
      <div class="row end"><button class="btn ncc-luu" id="ok">Lưu</button></div></div>`);
    [['#t', '#et'], ['#s', '#es']].forEach(([i, e]) => $(i).oninput = () => { $(i).classList.remove('err'); $(e).textContent = ''; });
    $('#ok').onclick = async () => {
      $('#me').innerHTML = ''; ['#t', '#s'].forEach(k => $(k).classList.remove('err')); ['#et', '#es'].forEach(k => $(k).textContent = '');
      const b = { tenNCC: $('#t').value.trim(), soDienThoai: $('#s').value.trim(), diaChi: $('#d').value.trim() };
      const banner = t => $('#me').innerHTML = `<div class="nk-alert red">${NK_IC.err} ${t}</div>`;
      const loi = (i, e, t) => { $(i).classList.add('err'); $(e).textContent = t; };
      if (!b.tenNCC || !b.soDienThoai) { if (!b.tenNCC) loi('#t', '#et', 'Vui lòng nhập tên nhà cung cấp'); if (!b.soDienThoai) loi('#s', '#es', 'Vui lòng nhập số điện thoại'); return banner('Vui lòng nhập đầy đủ thông tin'); }
      try {
        const r = n ? await api('PUT', '/api/ncc/' + n.maNCC, b) : await api('POST', '/api/ncc', b);
        NCC_FLASH.msg = n ? 'Thành công' : 'Thêm nhà cung cấp thành công'; NCC_FLASH.ma = n ? n.maNCC : r.maNCC;
        location.hash = n ? '#/ncc/sua' : '#/ncc/ds';
      } catch (e) {
        if (e.field === 'soDienThoai') loi('#s', '#es', e.error);
        else if (e.status === 409) { const t = n ? `Trùng với nhà cung cấp ${e.trungVoi || 'đã có'}` : 'Trùng với nhà cung cấp đã có';
          if (e.trungTen) loi('#t', '#et', t); if (e.trungSdt || !e.trungTen) loi('#s', '#es', t); banner(esc(e.error)); }
        else if (e.status === 400 && e.error) banner(esc(e.error));
        else ttLoi('Có lỗi xảy ra', n ? 'Hệ thống chưa lưu được thông tin.' : 'Hệ thống chưa lưu được nhà cung cấp.');
      }
    };
    return;
  }
  const tieuDe = { sua: 'Sửa thông tin nhà cung cấp', xoa: 'Xóa nhà cung cấp', ds: 'Danh sách nhà cung cấp' }[mode];
  shell(crumb('Nhà cung cấp', nhan), `${nkHead(tieuDe)}<div class="nk-search"><input id="q" class="inp" placeholder="Tìm theo tên hoặc số điện thoại"></div>
  <div class="card"><div class="nk-chead"><h3>Danh sách nhà cung cấp</h3><span class="muted" id="dem"></span></div><div id="ds"></div></div>`);
  const ve = list => {
    $('#dem').textContent = `${list.length} nhà cung cấp`;
    $('#ds').innerHTML = table([['Tên nhà cung cấp', r => `<b>${esc(r.tenNCC)}</b>`], ['Số điện thoại', r => fmtSdt(r.soDienThoai)], ['Địa chỉ', r => esc(r.diaChi || '')], ['Trạng thái', () => '<span class="badge b-green">Đang hợp tác</span>'],
      ...(mode === 'ds' ? [] : [['', r => mode === 'sua' ? `<button class="btn sm o" onclick="location.hash='#/ncc/sua/${r.maNCC}'">Chỉnh sửa thông tin</button>` : `<button class="btn sm o red ncc-xoa" data-d="${r.maNCC}">Xóa</button>`]])],
      list, 'Không tìm thấy nhà cung cấp', r => r.maNCC === NCC_FLASH.ma ? 'hh-hl-ok' : '');
    $$('[data-d]').forEach(b => b.onclick = () => xoa(rows.find(r => r.maNCC === b.dataset.d)));
  };
  const xoa = n => {
    const m = modal(`<div class="notice"><div class="big ncc-warn">!</div><h3>Xác nhận xóa nhà cung cấp?</h3><p class="muted">Nhà cung cấp ${esc(n.tenNCC)} sẽ bị xóa khỏi danh sách.</p>
      <div class="acts hh-2b"><button class="btn o" data-close>Hủy</button><button class="btn" id="ok">Xác nhận</button></div></div>`, 'narrow');
    $('#ok').onclick = async () => {
      m.close();
      try { await api('DELETE', '/api/ncc/' + n.maNCC); NCC_FLASH.msg = 'Xóa nhà cung cấp thành công'; pageNCC(mode); }
      catch (e) { if (e.conDon) ttLoi('Không thể xóa nhà cung cấp', esc(e.error)); else ttLoi('Có lỗi xảy ra', 'Hệ thống chưa xóa được nhà cung cấp.'); }
    };
  };
  ve(rows);
  $('#q').oninput = () => { const k = boDau($('#q').value.trim()).replace(/\s/g, ''); ve(rows.filter(r => boDau(r.tenNCC).replace(/\s/g, '').includes(k) || r.soDienThoai.includes(k))); };
  if (NCC_FLASH.msg) { nkFlash(NCC_FLASH.msg); NCC_FLASH.msg = null; setTimeout(() => NCC_FLASH.ma = null, 100); }
}
const NCC_FLASH = { msg: null, ma: null };

/* ---------- UC 8: Quản lý danh mục hàng hóa – bám Figma ---------- */
const HH_CN = {
  them: ['Thêm loại sản phẩm', 'Thêm loại sản phẩm mới để phân loại và quản lý hàng hóa trong kho.', '<path d="M12 5v14M5 12h14"/>'],
  sua: ['Sửa loại sản phẩm', 'Cập nhật thông tin của loại sản phẩm đã có trong danh mục.', '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>'],
  xoa: ['Xóa loại sản phẩm', 'Xóa loại sản phẩm không còn sử dụng khỏi danh mục.', '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'],
  timkiem: ['Tìm kiếm danh mục sản phẩm', 'Tra cứu nhanh loại sản phẩm theo mã hoặc tên.', '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>']
};
const hhIcon = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const srchInp = (id, ph, v = '') => `<div class="srch-inp"><span>${hhIcon('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>')}</span><input id="${id}" class="inp" autocomplete="off" placeholder="${ph}" value="${esc(v)}"></div>`;
function hhThongBao(tieuDe, noiDung) {
  const m = modal(`<div class="notice"><div class="big hh-i">!</div><h3>${tieuDe}</h3><p class="muted">${noiDung}</p></div>`, 'narrow');
  setTimeout(m.close, 2200);
}
async function pageHangHoa(cn, nhanManh) {
  // Màn chọn chức năng
  if (!HH_CN[cn]) {
    return shell(crumb('Hàng hóa'), `<h2 class="title hh-title">Quản lý danh mục hàng hóa</h2><p class="muted hh-sub">Chọn chức năng bạn muốn thực hiện</p>
    <div class="hh-grid">${Object.entries(HH_CN).map(([k, [t, mt, ic]]) => `<a class="hh-card" href="#/hanghoa/${k}"><div class="hh-top"><span class="hh-ic">${hhIcon(ic)}</span><b>${t}</b></div><p>${mt}</p><span class="hh-chon">Chọn →</span></a>`).join('')}</div>`);
  }
  const [rows, dm, kho] = await Promise.all([api('GET', '/api/nguyenlieu'), api('GET', '/api/danhmuc'), api('GET', '/api/kho')]);
  const lai = (ma, msg) => pageHangHoa(cn, ma).then(() => msg && nkFlash(msg));
  const cot = [['Mã sản phẩm', r => esc(r.maNguyenLieu)], ['Tên sản phẩm', r => esc(r.tenNguyenLieu)], ['Đơn vị tính', r => esc(r.donViTinh)], ['Mô tả', r => esc(r.moTa || '')]];
  const bang = (list, cls = () => '', them = []) => table([...cot, ...them], list, 'Không có danh mục sản phẩm để hiển thị', cls);
  const tieuDe = { them: 'Quản lý hàng hóa', sua: 'Sửa loại sản phẩm', xoa: 'Xóa loại sản phẩm', timkiem: 'Tìm kiếm danh mục sản phẩm' }[cn];
  const hl = r => r.maNguyenLieu === nhanManh ? 'hh-hl-ok' : '';

  // Biểu mẫu Thêm / Sửa (modal)
  const form = n => {
    const m = modal(`<h3>${n ? 'Sửa loại sản phẩm' : 'Thêm loại sản phẩm'}</h3><p class="muted hh-msub">${n ? 'Cập nhật thông tin loại sản phẩm. Mã sản phẩm không thể thay đổi.' : 'Nhập thông tin loại sản phẩm mới. Các trường có dấu * là bắt buộc.'}</p><div id="me"></div>
      <div class="field"><label class="f">Mã sản phẩm <i>*</i></label><input id="ma" class="inp" ${n ? 'readonly' : ''} value="${esc(n?.maNguyenLieu)}" placeholder="VD: NL-005"><div class="ferr" id="e_maNguyenLieu"></div></div>
      <div class="field"><label class="f">Tên sản phẩm <i>*</i></label><input id="ten" class="inp" value="${esc(n?.tenNguyenLieu)}" placeholder="Nhập tên sản phẩm"><div class="ferr" id="e_tenNguyenLieu"></div></div>
      <div class="field"><label class="f">Đơn vị tính <i>*</i></label><input id="dvt" class="inp" value="${esc(n?.donViTinh)}" placeholder="VD: hộp, kg, chai"><div class="ferr" id="e_donViTinh"></div></div>
      <div class="grid2"><div class="field"><label class="f">Danh mục</label><select id="dm" class="inp">${dm.map(d => `<option value="${d.maDanhMuc}" ${n?.maDanhMuc === d.maDanhMuc ? 'selected' : ''}>${esc(d.tenDanhMuc)}</option>`).join('')}</select></div>
        <div class="field"><label class="f">Kho</label><select id="kh" class="inp">${kho.map(k => `<option value="${k.maKho}" ${(n ? n.maKho : 'K02') === k.maKho ? 'selected' : ''}>${esc(k.tenKho)}</option>`).join('')}</select></div></div>
      <div class="field"><label class="f">Mô tả</label><textarea id="mt" class="inp" rows="3" placeholder="Nhập mô tả (không bắt buộc)">${esc(n?.moTa)}</textarea></div>
      <div class="acts"><button class="btn o" id="huy">Hủy</button><button class="btn" id="ok">Lưu</button></div>`);
    $('#huy').onclick = () => { m.close(); if (n) hhThongBao('Hủy chỉnh sửa loại sản phẩm', 'Thông tin loại sản phẩm được giữ nguyên.'); };
    $('#ok').onclick = async () => {
      $$('.ferr', m.el).forEach(x => x.textContent = ''); $$('.inp', m.el).forEach(x => x.classList.remove('err')); $('#me').innerHTML = '';
      const b = { maNguyenLieu: $('#ma').value.trim(), tenNguyenLieu: $('#ten').value.trim(), donViTinh: $('#dvt').value.trim(), maDanhMuc: $('#dm').value, maKho: $('#kh').value, moTa: $('#mt').value.trim() };
      const loi = (f, t) => { $('#e_' + f).textContent = t; $({ maNguyenLieu: '#ma', tenNguyenLieu: '#ten', donViTinh: '#dvt' }[f]).classList.add('err'); };
      const trong = { maNguyenLieu: 'Mã loại sản phẩm', tenNguyenLieu: 'Tên loại sản phẩm', donViTinh: 'Đơn vị tính' };
      let ok = true;
      for (const f of Object.keys(trong)) if (!b[f]) { loi(f, n ? `${trong[f]} không được để trống!` : 'Không được để trống!'); ok = false; }
      if (!ok) return;
      try {
        const kq = n ? await api('PUT', '/api/nguyenlieu/' + n.maNguyenLieu, b) : await api('POST', '/api/nguyenlieu', b); m.close();
        await lai(kq && kq.khoiPhuc || b.maNguyenLieu, n ? 'Cập nhật loại sản phẩm thành công!' : kq && kq.khoiPhuc ? `Đã khôi phục loại sản phẩm đã xóa trước đó (mã ${kq.khoiPhuc})!` : 'Thêm loại sản phẩm thành công!');
      } catch (e) {
        if (e.field && trong[e.field]) loi(e.field, e.error);
        else $('#me').innerHTML = `<div class="nk-alert red">${NK_IC.err} ${esc(nkLoiMang(e) ? 'Có lỗi xảy ra, vui lòng thử lại!' : e.error || 'Có lỗi xảy ra, vui lòng thử lại!')}</div>`;
      }
    };
  };
  const timTrong = q => { const k = boDau(q); return rows.filter(r => boDau(r.maNguyenLieu).includes(k) || boDau(r.tenNguyenLieu).includes(k)); };

  if (cn === 'them') {
    shell(crumb('Hàng hóa', 'Thêm loại sản phẩm'), `${nkHead(tieuDe, '<button class="btn" id="add">+ Thêm loại sản phẩm</button>')}
      <div class="card"><h3>Danh sách loại sản phẩm</h3>${bang(rows, hl)}</div>`);
    const gan = () => { if ($('#add')) $('#add').onclick = () => form(); }; gan();
    new MutationObserver(gan).observe($('#nkRight'), { childList: true });
    return;
  }
  if (cn === 'timkiem') {
    shell(crumb('Hàng hóa', tieuDe), `${nkHead(tieuDe)}
      <div class="card"><label class="f">Từ khóa tìm kiếm (Mã hoặc Tên danh mục)</label><div class="row">${srchInp('q', 'Nhập mã hoặc tên danh mục sản phẩm')}<button class="btn" id="go">Tìm kiếm</button></div><div class="ferr" id="qe"></div></div>
      <div class="card" id="res"></div>`);
    const ve = (list, q) => $('#res').innerHTML = `<div class="nk-chead"><h3>${q ? 'Kết quả tìm kiếm' : 'Danh sách danh mục sản phẩm'}</h3>${q ? `<span class="muted">Tìm thấy ${list.length} danh mục cho từ khóa “${esc(q)}”</span>` : ''}</div>${bang(list)}`;
    const tim = () => {
      const q = $('#q').value.trim(); $('#qe').textContent = ''; $('#q').classList.remove('err');
      if (!q) { $('#qe').textContent = 'Không được để trống!'; $('#q').classList.add('err'); return ve(rows); }
      const list = timTrong(q); if (!list.length) { $('#qe').textContent = 'Không tìm thấy danh mục sản phẩm phù hợp!'; $('#q').classList.add('err'); }
      ve(list, q);
    };
    $('#go').onclick = tim; $('#q').onkeydown = e => { if (e.key === 'Enter') tim(); }; ve(rows); $('#q').focus();
    return;
  }
  if (cn === 'sua') {
    shell(crumb('Hàng hóa', tieuDe), `${nkHead(tieuDe)}
      <div class="row hh-bar">${srchInp('q', 'Tìm kiếm theo mã hoặc tên loại sản phẩm')}<button class="btn" id="go">Tìm kiếm</button></div><div class="ferr" id="qe" style="margin:-10px 0 12px"></div>
      <div class="card"><h3>Chọn loại sản phẩm muốn sửa</h3><div id="res"></div></div>`);
    let chon = new Set();
    const ve = () => {
      $('#res').innerHTML = bang(rows, r => chon.has(r.maNguyenLieu) ? 'hh-hl-blue' : hl(r), [['Thao tác', r => `<button class="btn sm ${chon.has(r.maNguyenLieu) ? '' : 'o'} hh-sua" data-e="${r.maNguyenLieu}">Sửa</button>`]]);
      $$('[data-e]').forEach(b => b.onclick = () => form(rows.find(r => r.maNguyenLieu === b.dataset.e)));
    };
    const tim = () => {
      const q = $('#q').value.trim(); $('#qe').textContent = ''; $('#q').classList.remove('err');
      if (!q) { $('#qe').textContent = 'Không được để trống!'; $('#q').classList.add('err'); chon = new Set(); return ve(); }
      const list = timTrong(q); chon = new Set(list.map(r => r.maNguyenLieu));
      if (!list.length) { $('#qe').textContent = 'Không tìm thấy loại sản phẩm phù hợp!'; $('#q').classList.add('err'); }
      ve();
    };
    $('#go').onclick = tim; $('#q').onkeydown = e => { if (e.key === 'Enter') tim(); }; ve();
    return;
  }
  // Xóa loại sản phẩm
  shell(crumb('Hàng hóa', tieuDe), `${nkHead(tieuDe)}
    <div class="card"><label class="f">Mã loại sản phẩm cần xóa (hoặc Tên loại sản phẩm)</label><div class="row">${srchInp('q', 'Nhập mã hoặc tên loại sản phẩm')}<button class="btn" id="go">Kiểm tra</button></div><div class="ferr" id="qe"></div></div>
    <div id="info"></div><div class="card"><h3>Danh sách loại sản phẩm</h3><div id="res"></div></div>`);
  let chon = null;
  const ve = () => {
    $('#res').innerHTML = bang(rows, r => chon && r.maNguyenLieu === chon.maNguyenLieu ? 'hh-hl-red' : '');
    $('#info').innerHTML = chon ? `<div class="card"><h3>Thông tin loại sản phẩm</h3><div class="hh-info"><div><span>Mã sản phẩm</span><b>${esc(chon.maNguyenLieu)}</b></div><div><span>Tên sản phẩm</span><b>${esc(chon.tenNguyenLieu)}</b></div>
      <div><span>Đơn vị tính</span><b>${esc(chon.donViTinh)}</b></div><div class="grow"><span>Mô tả</span><b>${esc(chon.moTa || '–')}</b></div><button class="btn red" id="xoa">Xóa</button></div></div>` : '';
    if (chon) $('#xoa').onclick = xacNhan;
  };
  const xacNhan = () => {
    const n = chon;
    const m = modal(`<div class="notice"><div class="big hh-del">${hhIcon(HH_CN.xoa[2])}</div><h3>Xác nhận xóa loại sản phẩm</h3><p class="muted">Bạn có chắc chắn muốn xóa loại sản phẩm<br>“${esc(n.tenNguyenLieu)}” (${esc(n.maNguyenLieu)}) khỏi hệ thống không?</p>
      <div class="acts hh-2b"><button class="btn o" id="kh">Hủy</button><button class="btn" id="ok">Xóa</button></div></div>`, 'narrow');
    $('#kh').onclick = () => { m.close(); hhThongBao('Hủy xóa loại sản phẩm', 'Danh sách loại sản phẩm được giữ nguyên.'); };
    $('#ok').onclick = async () => {
      m.close();
      try { await api('DELETE', '/api/nguyenlieu/' + n.maNguyenLieu); await lai(null, 'Xóa loại sản phẩm thành công!'); }
      catch (e) { nkFlash('Có lỗi xảy ra, vui lòng thử lại sau!', 'err'); }
    };
  };
  const kiemTra = () => {
    const q = $('#q').value.trim(); $('#qe').textContent = ''; $('#q').classList.remove('err'); chon = null;
    if (!q) { $('#qe').textContent = 'Không được để trống!'; $('#q').classList.add('err'); return ve(); }
    const k = boDau(q);
    chon = rows.find(r => boDau(r.maNguyenLieu) === k || boDau(r.tenNguyenLieu) === k) || null;
    if (!chon) { const g = timTrong(q); if (g.length === 1) chon = g[0]; }
    if (!chon) { $('#qe').textContent = 'Không tìm thấy loại sản phẩm, vui lòng kiểm tra lại!'; $('#q').classList.add('err'); }
    ve();
  };
  $('#go').onclick = kiemTra; $('#q').onkeydown = e => { if (e.key === 'Enter') kiemTra(); }; ve();
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
      case 'nhapkho': return p[1] === 'lo' ? await pageLoHang(p[2]) : p[2] === 'hoadon' ? await pageHoaDon(p[1]) : p[1] ? await pageNhapForm(p[1]) : await pageNhapKho();
      case 'xuatkho': return p[1] === 'tao' ? await pageXuatForm() : await pageXuatKho();
      case 'lichsu': { const t = new URLSearchParams(location.hash.split('?')[1]).get('tab'); return await pageLichSu(p[1] || t); }
      case 'quanlytonkho': return await pageQuanLyTonKho();
      case 'kiemtra': return await pageKiemTra(p[1], p[2] && decodeURIComponent(p[2]));
      case 'theodoi': return await pageTheoDoi();
      case 'canhbao': return await pageCanhBao();
      case 'donhang': return p[1] === 'tao' ? await pageDonForm() : p[2] === 'sua' ? await pageDonForm(p[1]) : p[1] ? await pageDonChiTiet(p[1]) : await pageDonHang();
      case 'ncc': return await pageNCC(p[1] || 'them', p[2]);
      case 'hanghoa': return await pageHangHoa(p[1]);
      case 'baocao': return p[1] ? await pageBaoCaoChiTiet(p[1]) : pageBaoCao();
      case 'taikhoan': return await pageTaiKhoan();
      default: return await pageTongQuan();
    }
  } catch (e) { console.error(e); toast(e.error || 'Có lỗi xảy ra', 1); }
}
addEventListener('hashchange', router);
router();
