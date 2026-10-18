// ================= BANCO DE DADOS =================
const DB = {
  get(key, fallback = []) { const data = localStorage.getItem('yumi_' + key); return data ? JSON.parse(data) : fallback; },
  set(key, val) { localStorage.setItem('yumi_' + key, JSON.stringify(val)); if (window.broadcastChannel) window.broadcastChannel.postMessage({ key, val }); }
};

window.broadcastChannel = new BroadcastChannel('yumi_sync');
window.broadcastChannel.onmessage = (event) => {
  if (event.data.key === 'products') renderProducts();
  if (event.data.key === 'cart') renderCart();
  if (event.data.key === 'orders') renderAdmPendingOrders();
};

const defaultProducts = [
  { id: 1, title: '50 CAPAS DA OPTIFINE', price: 0.55, oldPrice: 10.90, discount: 94, image: 'https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=400&q=80', desc: 'Acesso completo.' },
  { id: 2, title: 'MINECRAFT JAVA EDITION', price: 29.90, oldPrice: 49.90, discount: 40, image: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=400&q=80', desc: 'Conta oficial.' }
];
if (!DB.get('products').length) DB.set('products', defaultProducts);

// ================= LOGIN E SESSÃO =================
function login(identifier, password) {
  // LOGIN ADM ESPECÍFICO
  if ((identifier === 'YumiAdm' || identifier === 'yumiggcomercial@gmail.com') && password === 'fassbinder201432657788') {
    DB.set('session', { role: 'admin', name: 'YumiAdm', email: 'yumiggcomercial@gmail.com' });
    return { success: true, role: 'admin' };
  }
  // LOGIN USUÁRIO (Pode ser Email ou Nick)
  const users = DB.get('users', []);
  const user = users.find(u => (u.email === identifier || u.name === identifier) && u.password === password);
  if (user) {
    DB.set('session', { role: 'user', name: user.name, email: user.email });
    return { success: true, role: 'user' };
  }
  return { error: 'Usuário ou senha incorretos.' };
}

function logout() { localStorage.removeItem('yumi_session'); window.location.href = 'index.html'; }
function getSession() { return DB.get('session', null); }

function updateHeaderAuth() {
  const session = getSession();
  const authBtn = document.getElementById('headerAuthBtn');
  if (!authBtn) return;
  if (session) {
    authBtn.innerHTML = `Olá, ${session.name}`;
    authBtn.href = session.role === 'admin' ? '#' : 'dashboard.html';
    if (session.role === 'admin') authBtn.onclick = (e) => { e.preventDefault(); openAdm(); };
  } else {
    authBtn.innerHTML = 'Entrar';
    authBtn.href = 'login.html';
  }
}

// ================= CARRINHO =================
function addToCart(id) {
  let cart = DB.get('cart', []);
  const item = cart.find(i => i.id === id);
  if (item) item.qty += 1;
  else cart.push({ id, qty: 1 });
  DB.set('cart', cart);
  alert('Adicionado ao carrinho!');
}

function renderCart() {
  const container = document.getElementById('cartItemsContainer');
  if (!container) return;
  const cart = DB.get('cart', []);
  const products = DB.get('products', []);
  
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <svg width="60" height="60" fill="none" stroke="#555" stroke-width="1" viewBox="0 0 24 24" style="margin-bottom:20px;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        <h2>Monte um carrinho de compras</h2>
        <a href="index.html" style="color:white; text-decoration:underline; margin-top:10px; display:block;">Descobrir produtos</a>
      </div>`;
    document.getElementById('cartSummary').innerHTML = `<p style="color:var(--text-muted)">Aqui você encontrará os valores da sua compra assim que adicionar produtos.</p>`;
    return;
  }

  let total = 0;
  container.innerHTML = cart.map(item => {
    const p = products.find(x => x.id === item.id);
    if (!p) return '';
    total += p.price * item.qty;
    return `
      <div class="cart-item">
        <img src="${p.image}">
        <div class="cart-item-info">
          <h4>${p.title}</h4>
          <p style="color:var(--text-muted); font-size:0.9rem;">R$ ${p.price.toFixed(2)} x ${item.qty}</p>
        </div>
        <button class="btn-outline" onclick="removeCart(${p.id})" style="padding:5px 10px; font-size:0.8rem;">Remover</button>
      </div>
    `;
  }).join('');

  document.getElementById('cartSummary').innerHTML = `
    <h3>Resumo da compra</h3>
    <div class="cart-total"><span>Total:</span> <span>R$ ${total.toFixed(2)}</span></div>
    <button class="btn-primary" style="width:100%; margin-top:20px;" onclick="checkout(${total})">Finalizar Compra</button>
  `;
}

function removeCart(id) {
  let cart = DB.get('cart', []).filter(i => i.id !== id);
  DB.set('cart', cart);
}

function checkout(total) {
  const session = getSession();
  if (!session) { alert('Faça login para comprar!'); window.location.href = 'login.html'; return; }
  
  const cart = DB.get('cart', []);
  const orders = DB.get('orders', []);
  orders.push({
    id: 'PED-' + Date.now(),
    user: session.name,
    items: cart,
    total: total,
    date: new Date().toLocaleString(),
    status: 'Pendente'
  });
  DB.set('orders', orders);
  DB.set('cart', []);
  alert('Compra realizada! Verifique o painel do ADM.');
  renderCart();
}

// ================= PAINEL ADM (FLUTUANTE) =================
function openAdm() {
  document.getElementById('floating-adm').classList.add('open');
  document.body.classList.add('adm-expanded');
  renderAdmPendingOrders();
  renderAdmProducts();
}

function closeAdm() {
  document.getElementById('floating-adm').classList.remove('open');
  document.body.classList.remove('adm-expanded');
}

function expandAdm() {
  const adm = document.getElementById('floating-adm');
  if (adm.style.width === '100%') {
    adm.style.width = '450px';
    adm.style.right = '0';
    document.body.classList.remove('adm-fullscreen');
  } else {
    adm.style.width = '100%';
    document.body.classList.add('adm-fullscreen');
  }
}

function switchAdmTab(tabId, btn) {
  document.querySelectorAll('.adm-section').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.adm-nav button').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
}

// --- ADM: PRODUTOS ---
function createProduct(e) {
  e.preventDefault();
  const products = DB.get('products', []);
  products.push({
    id: Date.now(),
    title: document.getElementById('p-title').value,
    price: parseFloat(document.getElementById('p-price').value),
    oldPrice: parseFloat(document.getElementById('p-old').value) || parseFloat(document.getElementById('p-price').value),
    discount: parseInt(document.getElementById('p-discount').value) || 0,
    image: document.getElementById('p-image').value,
    desc: 'Produto criado pelo ADM.'
  });
  DB.set('products', products);
  alert('Produto criado!');
  e.target.reset();
}

function renderAdmProducts() {
  const list = document.getElementById('adm-product-list');
  if (!list) return;
  list.innerHTML = DB.get('products', []).map(p => `
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:10px 0;">
      <span style="color:#333; font-size:0.9rem;">${p.title}</span>
      <span style="color:var(--pink); font-weight:bold;">R$ ${p.price.toFixed(2)}</span>
    </div>
  `).join('');
}

// --- ADM: PENDENTES / VENDAS ---
function renderAdmPendingOrders() {
  const list = document.getElementById('adm-orders-list');
  if (!list) return;
  const orders = DB.get('orders', []);
  if (!orders.length) {
    list.innerHTML = '<p style="color:#888;">Nenhum carrinho pendente.</p>';
    return;
  }
  list.innerHTML = orders.map(o => `
    <div style="background:#f9f9f9; border:1px solid #ddd; padding:10px; border-radius:6px; margin-bottom:10px;">
      <strong style="color:#333;">${o.user}</strong> - R$ ${o.total.toFixed(2)} <br>
      <small style="color:#666;">${o.date}</small> <br>
      <span style="background:orange; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem;">${o.status}</span>
    </div>
  `).join('');
}

// --- ADM: CUPONS ---
function createCoupon(e) {
  e.preventDefault();
  let code = document.getElementById('c-code').value;
  const type = document.getElementById('c-type').value;
  const value = document.getElementById('c-value').value;

  // Regra: Obrigatório terminar com o desconto (ex: yumi10)
  if (!code.endsWith(value)) {
    code = code + value;
  }

  const coupons = DB.get('coupons', []);
  coupons.push({ code, type, value, id: Date.now() });
  DB.set('coupons', coupons);
  alert(`Cupom ${code} criado com sucesso!`);
  e.target.reset();
}

// ================= INICIALIZAÇÃO =================
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderAuth();
  renderProducts();
  renderCart();
  
  // Se for admin, mostra o botão flutuante
  const session = getSession();
  if (session && session.role === 'admin') {
    document.getElementById('open-adm-btn').style.display = 'flex';
  } else {
    const adm = document.getElementById('open-adm-btn');
    if (adm) adm.style.display = 'none';
  }
});

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = DB.get('products', []).map(p => `
    <div class="product-card">
      <a href="produto.html?id=${p.id}"><img src="${p.image}"></a>
      <a href="produto.html?id=${p.id}"><h3 style="font-size:0.95rem; margin-bottom:8px;">${p.title}</h3></a>
      <div class="price">R$ ${p.price.toFixed(2)}</div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <a href="produto.html?id=${p.id}" class="btn-primary" style="flex:1; padding:8px; font-size:0.9rem;">Comprar</a>
        <button class="btn-outline" onclick="addToCart(${p.id})" style="padding:8px;">+ 🛒</button>
      </div>
    </div>
  `).join('');
}
