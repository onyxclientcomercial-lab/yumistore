// ================= BANCO DE DADOS =================
const DB = {
  get(key, fallback = []) { const data = localStorage.getItem('yumi_' + key); return data ? JSON.parse(data) : fallback; },
  set(key, val) { localStorage.setItem('yumi_' + key, JSON.stringify(val)); if (window.broadcastChannel) window.broadcastChannel.postMessage({ key, val }); }
};

window.broadcastChannel = new BroadcastChannel('yumi_sync');
window.broadcastChannel.onmessage = (event) => {
  if (event.data.key === 'orders') renderAdmOrders();
  if (event.data.key === 'cart') renderCart();
};

// Catálogo Inicial de Exemplo
if (!DB.get('products').length) {
  DB.set('products', [
    { id: 1, title: '50 CAPAS DA OPTIFINE (NFA)', price: 0.55, oldPrice: 10.90, discount: 94, image: 'https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=400&q=80' },
    { id: 2, title: 'MINECRAFT JAVA PREMIUM', price: 29.90, oldPrice: 49.90, discount: 40, image: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=400&q=80' }
  ]);
}

// ================= LOGIN & SESSÃO =================
function login(identifier, password) {
  // Acesso YumiAdm
  if ((identifier === 'YumiAdm' || identifier === 'yumiggcomercial@gmail.com') && password === 'fassbinder201432657788') {
    DB.set('session', { role: 'admin', name: 'YumiAdm' });
    return { success: true, role: 'admin' };
  }
  // Acesso Usuário (Email ou Nick)
  const users = DB.get('users', []);
  const user = users.find(u => (u.email === identifier || u.nick === identifier) && u.password === password);
  if (user) {
    DB.set('session', { role: 'user', name: user.nick });
    return { success: true, role: 'user' };
  }
  return { error: 'Usuário/E-mail ou senha incorretos.' };
}

function logout() { localStorage.removeItem('yumi_session'); window.location.reload(); }
function getSession() { return DB.get('session', null); }

function updateHeaderAuth() {
  const session = getSession();
  const btn = document.getElementById('headerAuthBtn');
  const cartBtn = document.getElementById('headerCartBtn');
  
  if (btn) {
    if (session) {
      btn.innerHTML = `👤 Olá, ${session.name}`;
      btn.href = session.role === 'admin' ? '#' : 'dashboard.html';
      if (session.role === 'admin') {
        btn.onclick = (e) => { e.preventDefault(); openAdm(); };
      }
    } else {
      btn.innerHTML = 'Entrar';
      btn.href = 'login.html';
    }
  }

  // Mostra botão flutuante se for ADM
  const admBtn = document.getElementById('open-adm-btn');
  if (admBtn) admBtn.style.display = (session && session.role === 'admin') ? 'flex' : 'none';
}

// ================= LOJA & CARRINHO =================
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
  const summary = document.getElementById('cartSummaryBox');
  
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
        <h2>Monte um carrinho de compras</h2>
        <a href="index.html">Descobrir produtos</a>
      </div>`;
    if(summary) summary.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Aqui você encontrará os valores da sua compra assim que adicionar produtos.</p>`;
    return;
  }

  let total = 0;
  container.innerHTML = cart.map(item => {
    const p = products.find(x => x.id === item.id);
    if (!p) return '';
    total += p.price * item.qty;
    return `
      <div class="cart-item-row">
        <img src="${p.image}">
        <div style="flex:1">
          <h4 style="font-size:0.95rem;">${p.title}</h4>
          <p style="color:var(--text-muted); font-size:0.85rem;">Qtd: ${item.qty} | R$ ${p.price.toFixed(2)}</p>
        </div>
        <button class="btn-outline" onclick="removeCart(${p.id})" style="padding:4px 10px; font-size:0.8rem;">Remover</button>
      </div>`;
  }).join('');

  if(summary) {
    summary.innerHTML = `
      <h3 style="margin-bottom:15px;">Resumo</h3>
      <div class="cart-total-row"><span>Subtotal:</span> <span>R$ ${total.toFixed(2)}</span></div>
      <button class="btn-primary" style="width:100%; margin-top:20px; background:var(--purple);" onclick="checkout(${total})">Finalizar Compra</button>
    `;
  }
}

function removeCart(id) {
  let cart = DB.get('cart', []).filter(i => i.id !== id);
  DB.set('cart', cart);
}

function checkout(total) {
  const session = getSession();
  if (!session) { alert('Faça login para comprar!'); window.location.href = 'login.html'; return; }
  
  const orders = DB.get('orders', []);
  orders.push({
    id: 'PED-' + Date.now(),
    user: session.name,
    items: DB.get('cart', []),
    total: total,
    status: 'Pendente',
    date: new Date().toLocaleString()
  });
  DB.set('orders', orders);
  DB.set('cart', []);
  alert('Compra enviada para o painel!');
  renderCart();
}

// ================= PAINEL ADM (ROSA) =================
function openAdm() {
  document.getElementById('floating-adm').classList.add('open');
  renderAdmOrders();
  renderAdmProducts();
}

function closeAdm() { document.getElementById('floating-adm').classList.remove('open'); }

function toggleFullScreenAdm() {
  const adm = document.getElementById('floating-adm');
  adm.classList.toggle('expanded');
}

function switchAdmTab(tabId, btn) {
  document.querySelectorAll('.adm-section').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.adm-nav button').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
}

// Vendas Pendentes
function renderAdmOrders() {
  const list = document.getElementById('adm-orders-list');
  if (!list) return;
  const orders = DB.get('orders', []);
  
  if (!orders.length) { list.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma compra pendente no momento.</p>'; return; }
  
  list.innerHTML = orders.map(o => `
    <div style="background:#f4f4f5; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #e4e4e7;">
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <strong style="color:#333;">${o.user}</strong>
        <span style="color:var(--green); font-weight:bold;">R$ ${o.total.toFixed(2)}</span>
      </div>
      <span style="background:var(--pink); color:white; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold;">${o.status}</span>
      <p style="font-size:0.8rem; color:#666; margin-top:5px;">${o.date}</p>
    </div>
  `).join('');
}

// Criar Produto
function createProduct(e) {
  e.preventDefault();
  const products = DB.get('products', []);
  products.push({
    id: Date.now(),
    title: document.getElementById('p-title').value,
    price: parseFloat(document.getElementById('p-price').value),
    oldPrice: parseFloat(document.getElementById('p-price').value) * 1.5,
    discount: 30,
    image: document.getElementById('p-image').value
  });
  DB.set('products', products);
  alert('Produto criado com sucesso!');
  e.target.reset();
  renderAdmProducts();
  if(document.getElementById('productsGrid')) window.location.reload(); // Atualiza a vitrine se estiver nela
}

function renderAdmProducts() {
  const list = document.getElementById('adm-product-list');
  if (!list) return;
  list.innerHTML = DB.get('products', []).map(p => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee; font-size:0.9rem;">
      <span style="color:#333;">${p.title}</span>
      <strong style="color:var(--pink);">R$ ${p.price.toFixed(2)}</strong>
    </div>
  `).join('');
}

// Criar Cupom (Regra de Nome Obrigatória)
function createCoupon(e) {
  e.preventDefault();
  let baseCode = document.getElementById('c-code').value.toLowerCase();
  const value = document.getElementById('c-value').value;

  // Força o código a terminar com o valor. Ex: yumi + 10 = yumi10
  if (!baseCode.endsWith(value)) {
    baseCode += value; 
  }

  const coupons = DB.get('coupons', []);
  coupons.push({ code: baseCode, value: value, type: 'percent' });
  DB.set('coupons', coupons);
  
  alert(`✅ Cupom gerado: ${baseCode} (${value}% OFF)`);
  e.target.reset();
}

// Adicionar Membro Equipe
function addTeamMember(e) {
  e.preventDefault();
  alert('Membro adicionado ao sistema com sucesso! (Simulação)');
  e.target.reset();
}

// ================= INICIALIZAÇÃO GERAL =================
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderAuth();
  renderCart();
  
  // Renderiza os produtos na tela inicial
  const grid = document.getElementById('productsGrid');
  if (grid) {
    grid.innerHTML = DB.get('products', []).map(p => `
      <div class="product-card">
        <img src="${p.image}">
        <h3 style="font-size:0.95rem; margin-bottom:5px;">${p.title}</h3>
        <div class="price">R$ ${p.price.toFixed(2)}</div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <a href="produto.html?id=${p.id}" class="btn-primary" style="flex:1; padding:8px; font-size:0.85rem;">Comprar</a>
          <button class="btn-outline" onclick="addToCart(${p.id})" style="padding:8px;">🛒</button>
        </div>
      </div>
    `).join('');
  }
});
