// ============ BANCO DE DADOS LOCAL ============
const DB = {
  get(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem('yumi_' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem('yumi_' + key, JSON.stringify(val)); }
};

// Catálogo fixo
const PRODUCTS = [
  { id: 1, name: 'Minecraft Java Edition', price: 29.90, category: 'Conta', icon: '☕', desc: 'Conta Java oficial com garantia vitalícia.' },
  { id: 2, name: 'Minecraft Bedrock Edition', price: 19.90, category: 'Conta', icon: '📱', desc: 'Conta Bedrock para todas as plataformas.' },
  { id: 3, name: 'Java + Bedrock Combo', price: 39.90, category: 'Combo', icon: '🎁', desc: 'Melhor custo-benefício das duas versões.' },
  { id: 4, name: 'Optifine Cape', price: 9.90, category: 'Cosmético', icon: '🧥', desc: 'Capa exclusiva Optifine.' },
  { id: 5, name: 'VIP Rank (30 dias)', price: 14.90, category: 'Servidor', icon: '👑', desc: 'Rank VIP em servidores parceiros.' },
  { id: 6, name: 'Gift Card R$ 50', price: 50.00, category: 'Gift Card', icon: '💳', desc: 'Gift card para usar na loja.' }
];

// ============ AUTENTICAÇÃO (simulada) ============
// Hash simples só pra não guardar senha em texto puro (NÃO é seguro pra produção real, mas ok pra demo)
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return 'h' + Math.abs(h).toString(36) + '_' + str.length;
}

function getUsers() { return DB.get('users', []); }
function saveUsers(u) { DB.set('users', u); }

function register(username, email, password) {
  if (!username || !email || !password) return { error: 'Preencha todos os campos.' };
  if (username.length < 3 || username.length > 20) return { error: 'Usuário deve ter 3–20 caracteres.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'E-mail inválido.' };
  if (password.length < 8) return { error: 'Senha deve ter no mínimo 8 caracteres.' };

  const users = getUsers();
  if (users.find(u => u.email === email.toLowerCase())) return { error: 'E-mail já cadastrado.' };
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return { error: 'Usuário já em uso.' };

  users.push({
    id: 'u' + Date.now(),
    username,
    email: email.toLowerCase(),
    passwordHash: simpleHash(password),
    balance: 0,
    createdAt: new Date().toISOString()
  });
  saveUsers(users);
  return { success: true };
}

function login(email, password) {
  if (!email || !password) return { error: 'Preencha e-mail e senha.' };
  const users = getUsers();
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return { error: 'E-mail ou senha incorretos.' };
  if (user.passwordHash !== simpleHash(password)) return { error: 'E-mail ou senha incorretos.' };
  DB.set('session', { id: user.id, username: user.username, email: user.email });
  return { success: true, user };
}

function logout() { localStorage.removeItem('yumi_session'); }

function currentUser() {
  const s = DB.get('session', null);
  if (!s) return null;
  return getUsers().find(u => u.id === s.id) || null;
}

function requireLogin() {
  if (!currentUser()) { window.location.href = 'login.html'; return false; }
  return true;
}

// ============ CARRINHO ============
function getCart() { return DB.get('cart', []); }
function saveCart(c) { DB.set('cart', c); updateCartBadge(); }

function addToCart(id) {
  const cart = getCart();
  const it = cart.find(i => i.id === id);
  if (it) it.qty = Math.min(10, it.qty + 1);
  else cart.push({ id, qty: 1 });
  saveCart(cart);
}

function updateCartBadge() {
  const total = getCart().reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(el => el.textContent = total);
}

// ============ PEDIDOS ============
function getOrders() { return DB.get('orders', []); }
function saveOrders(o) { DB.set('orders', o); }

function checkout(items) {
  const user = currentUser();
  if (!user) return { error: 'Faça login primeiro.' };
  if (!items || !items.length) return { error: 'Carrinho vazio.' };

  let total = 0;
  const orderItems = [];
  for (const it of items) {
    const p = PRODUCTS.find(x => x.id === it.id);
    if (!p) continue;
    const qty = Math.max(1, Math.min(10, it.qty));
    total += p.price * qty;
    orderItems.push({ productId: p.id, name: p.name, price: p.price, qty });
  }

  const users = getUsers();
  const u = users.find(x => x.id === user.id);
  if (u.balance < total) {
    return { error: `Saldo insuficiente. Necessário R$ ${total.toFixed(2)}. Seu saldo: R$ ${u.balance.toFixed(2)}.`, needTopup: true };
  }
  u.balance -= total;
  saveUsers(users);

  const orders = getOrders();
  const order = {
    id: 'ORD-' + Date.now(),
    userId: u.id,
    items: orderItems,
    total,
    status: 'Aguardando entrega',
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  saveOrders(orders);
  saveCart([]);
  return { success: true, order };
}

function topup(amount) {
  const user = currentUser();
  if (!user) return { error: 'Faça login.' };
  const val = Number(amount);
  if (!val || val <= 0 || val > 1000) return { error: 'Valor inválido (1–1000).' };
  const users = getUsers();
  const u = users.find(x => x.id === user.id);
  u.balance += val;
  saveUsers(users);
  return { success: true, balance: u.balance };
}

// ============ TICKETS / ATENDIMENTO ============
function getTickets() { return DB.get('tickets', []); }
function saveTickets(t) { DB.set('tickets', t); }

function createTicket(subject, message) {
  const user = currentUser();
  if (!user) return { error: 'Faça login.' };
  if (!subject || !message) return { error: 'Preencha assunto e mensagem.' };
  if (subject.length > 100 || message.length > 2000) return { error: 'Texto muito longo.' };

  const tickets = getTickets();
  const ticket = {
    id: 'TK-' + Date.now(),
    userId: user.id,
    username: user.username,
    subject,
    status: 'Aberto',
    messages: [{ from: 'user', text: message, at: new Date().toISOString() }],
    createdAt: new Date().toISOString()
  };
  tickets.push(ticket);
  saveTickets(tickets);
  return { success: true, ticket };
}

function replyTicket(id, message) {
  const user = currentUser();
  if (!user) return { error: 'Faça login.' };
  if (!message) return { error: 'Mensagem vazia.' };
  const tickets = getTickets();
  const t = tickets.find(x => x.id === id && x.userId === user.id);
  if (!t) return { error: 'Ticket não encontrado.' };
  t.messages.push({ from: 'user', text: message, at: new Date().toISOString() });
  if (t.status === 'Resolvido') t.status = 'Aberto';
  saveTickets(tickets);
  return { success: true, ticket: t };
}

// ============ UTIL ============
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function updateNav() {
  const user = currentUser();
  const nav = document.getElementById('navAuth');
  if (!nav) return;
  if (user) {
    nav.innerHTML = `<a href="dashboard.html">Olá, ${escapeHtml(user.username)}</a>
      <a href="#" id="logoutNav">Sair</a>`;
    document.getElementById('logoutNav').addEventListener('click', (e) => {
      e.preventDefault(); logout(); window.location.reload();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  updateNav();
});
