// ================= BANCO DE DADOS =================
const DB = {
  get(key, fallback = []) {
    const data = localStorage.getItem('yumi_' + key);
    return data ? JSON.parse(data) : fallback;
  },
  set(key, val) {
    localStorage.setItem('yumi_' + key, JSON.stringify(val));
    if (window.broadcastChannel) window.broadcastChannel.postMessage({ key, val });
  }
};

// Sincronização entre abas em Tempo Real
window.broadcastChannel = new BroadcastChannel('yumi_sync');
window.broadcastChannel.onmessage = (event) => {
  if (event.data.key === 'products') renderProducts();
  if (event.data.key === 'online') renderOnlineCount();
};

// Produtos Padrão (Caso não tenha nenhum)
const defaultProducts = [
  { id: 1, title: '50 CAPAS DA OPTIFINE (NFA + ACESSO AO PAINEL)', price: 0.55, oldPrice: 10.90, discount: 94, desc: 'Acesso completo ao painel para gerenciar suas capas.', image: 'https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=400&q=80', reviews: [] },
  { id: 2, title: 'MINECRAFT JAVA EDITION PREMIUM', price: 29.90, oldPrice: 49.90, discount: 40, desc: 'Conta Java oficial com garantia vitalícia.', image: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=400&q=80', reviews: [] }
];

if (!DB.get('products').length) DB.set('products', defaultProducts);

// ÍCONES SVG (Substituindo Emojis)
const Icons = {
  user: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  cart: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
  discord: `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>`,
  search: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg>`,
  chat: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
  arrowRight: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`
};

// ================= SISTEMA DE LOGIN =================
function login(email, password) {
  // Verifica Admin
  if (email === 'yumiggcomercial@gmail.com' && password === 'fassbinder201432657788') {
    DB.set('session', { role: 'admin', email });
    return { success: true, role: 'admin' };
  }

  // Verifica Usuário Comum
  const users = DB.get('users', []);
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    DB.set('session', { role: 'user', email, name: user.name });
    return { success: true, role: 'user' };
  }
  return { error: 'E-mail ou senha incorretos.' };
}

function register(name, email, password) {
  const users = DB.get('users', []);
  if (users.find(u => u.email === email)) return { error: 'E-mail já cadastrado.' };
  users.push({ name, email, password });
  DB.set('users', users);
  return { success: true };
}

function logout() { localStorage.removeItem('yumi_session'); window.location.href = 'index.html'; }
function getSession() { return DB.get('session', null); }

// ================= PRODUTOS & VITRINE =================
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  const products = DB.get('products');
  
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <a href="produto.html?id=${p.id}">
        <img src="${p.image}" alt="${p.title}">
      </a>
      <a href="produto.html?id=${p.id}"><h3>${p.title}</h3></a>
      <div>
        <span class="price-old">R$ ${Number(p.oldPrice).toFixed(2)}</span>
        <span class="discount">${p.discount}% OFF</span>
      </div>
      <div class="price-current">R$ ${Number(p.price).toFixed(2)}</div>
      <div class="price-pix">À vista no PIX</div>
      <div class="card-actions">
        <button class="btn-comprar" onclick="buyNow(${p.id})">Comprar</button>
        <button class="btn-add-cart" onclick="addToCart(${p.id})" title="Adicionar ao carrinho">
          ${Icons.cart}
        </button>
      </div>
    </div>
  `).join('');
}

function buyNow(id) {
  const session = getSession();
  if (!session) { alert('Faça login para comprar.'); window.location.href = 'login.html'; return; }
  alert('Compra simulada com sucesso! (Integração de pagamento pendente)');
}

// ================= ADMIN: CRIAR PRODUTO =================
function createProduct(e) {
  e.preventDefault();
  const products = DB.get('products');
  const newProduct = {
    id: Date.now(),
    title: document.getElementById('adm-title').value,
    price: parseFloat(document.getElementById('adm-price').value),
    oldPrice: parseFloat(document.getElementById('adm-oldPrice').value),
    discount: parseInt(document.getElementById('adm-discount').value),
    image: document.getElementById('adm-image').value,
    desc: document.getElementById('adm-desc').value,
    reviews: []
  };
  products.push(newProduct);
  DB.set('products', products);
  alert('Produto criado com sucesso!');
  document.getElementById('form-product').reset();
  loadAdminProducts();
}

function loadAdminProducts() {
  const tbody = document.getElementById('admin-products-body');
  if (!tbody) return;
  const products = DB.get('products');
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image}" width="40" style="border-radius:4px;"></td>
      <td>${p.title}</td>
      <td>R$ ${p.price.toFixed(2)}</td>
      <td><button onclick="deleteProduct(${p.id})" style="color:red; background:none; border:none; cursor:pointer;">Excluir</button></td>
    </tr>
  `).join('');
}

function deleteProduct(id) {
  if (!confirm('Tem certeza?')) return;
  const products = DB.get('products').filter(p => p.id !== id);
  DB.set('products', products);
  loadAdminProducts();
}

// ================= TEMPO REAL (ONLINE) =================
function initOnlineTracker() {
  const badge = document.getElementById('onlineBadge');
  if (!badge) return;

  const sessionId = Math.random().toString(36).substr(2, 9);
  let onlineUsers = DB.get('online', {});
  
  // Adiciona o usuário atual e atualiza a hora
  onlineUsers[sessionId] = Date.now();
  DB.set('online', onlineUsers);

  // Remove usuários inativos (mais de 10 segundos sem ping)
  setInterval(() => {
    let currentOnline = DB.get('online', {});
    const now = Date.now();
    for (let id in currentOnline) {
      if (now - currentOnline[id] > 10000) delete currentOnline[id];
    }
    currentOnline[sessionId] = now;
    DB.set('online', currentOnline);
    updateOnlineUI(Object.keys(currentOnline).length);
  }, 5000);

  updateOnlineUI(Object.keys(onlineUsers).length);
}

function updateOnlineUI(count) {
  const el = document.getElementById('onlineCount');
  if (el) el.innerText = count;
}

function addToCart(id) {
  const session = getSession();
  if (!session) { alert('Faça login para adicionar ao carrinho.'); window.location.href = 'login.html'; return; }
  alert('Adicionado ao carrinho com sucesso!');
}

// ================= INICIALIZAÇÃO =================
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  initOnlineTracker();
  loadAdminProducts();
  
  // Atualiza ícones no Header
  const iconSpan = document.getElementById('icon-discord');
  if (iconSpan) iconSpan.innerHTML = Icons.discord;
  const searchIcon = document.getElementById('icon-search');
  if (searchIcon) searchIcon.innerHTML = Icons.search;
  const cartIcon = document.getElementById('icon-cart');
  if (cartIcon) cartIcon.innerHTML = Icons.cart;
  const userIcon = document.getElementById('icon-user');
  if (userIcon) userIcon.innerHTML = Icons.user;
});
