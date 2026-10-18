const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Garante arquivos
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const files = {
  users: path.join(DATA_DIR, 'users.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  tickets: path.join(DATA_DIR, 'tickets.json')
};
Object.values(files).forEach(f => { if (!fs.existsSync(f)) fs.writeFileSync(f, '[]'); });

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf-8'));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// Catálogo fixo de produtos
const PRODUCTS = [
  { id: 1, name: 'Minecraft Java Edition', price: 29.90, category: 'Conta', icon: '☕', desc: 'Conta Java oficial com garantia vitalícia.' },
  { id: 2, name: 'Minecraft Bedrock Edition', price: 19.90, category: 'Conta', icon: '📱', desc: 'Conta Bedrock para todas as plataformas.' },
  { id: 3, name: 'Java + Bedrock Combo', price: 39.90, category: 'Combo', icon: '🎁', desc: 'Melhor custo-benefício das duas versões.' },
  { id: 4, name: 'Optifine Cape', price: 9.90, category: 'Cosmético', icon: '🧥', desc: 'Capa exclusiva Optifine.' },
  { id: 5, name: 'VIP Rank (30 dias)', price: 14.90, category: 'Servidor', icon: '👑', desc: 'Rank VIP em servidores parceiros.' },
  { id: 6, name: 'Gift Card R$ 50', price: 50.00, category: 'Gift Card', icon: '💳', desc: 'Gift card para usar na loja.' }
];

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' }
});

function authRequired(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function authOptional(req, res, next) {
  const token = req.cookies.token;
  if (token) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch {}
  }
  next();
}

// ============ AUTENTICAÇÃO ============

app.post('/api/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Usuário deve ter 3–20 caracteres.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 8) return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres.' });

  const users = read(files.users);
  if (users.find(u => u.email === email.toLowerCase())) return res.status(409).json({ error: 'E-mail já cadastrado.' });
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'Usuário já em uso.' });

  const hash = await bcrypt.hash(password, 12);
  users.push({
    id: Date.now().toString(),
    username,
    email: email.toLowerCase(),
    password: hash,
    balance: 0,
    createdAt: new Date().toISOString()
  });
  write(files.users, users);
  res.json({ success: true, message: 'Conta criada! Faça login.' });
});

app.post('/api/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Preencha e-mail e senha.' });
  const users = read(files.users);
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

  const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, user: { username: user.username, email: user.email } });
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });

app.get('/api/me', authRequired, (req, res) => {
  const users = read(files.users);
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  const orders = read(files.orders).filter(o => o.userId === user.id);
  const tickets = read(files.tickets).filter(t => t.userId === user.id);
  res.json({
    username: user.username, email: user.email, balance: user.balance,
    orders, tickets: tickets.map(t => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt }))
  });
});

// ============ PRODUTOS ============

app.get('/api/products', (req, res) => res.json(PRODUCTS));

// ============ VENDAS / PEDIDOS ============

app.post('/api/checkout', authRequired, (req, res) => {
  const { items } = req.body; // [{id, qty}]
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Carrinho vazio.' });

  const users = read(files.users);
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  let total = 0;
  const orderItems = [];
  for (const it of items) {
    const p = PRODUCTS.find(x => x.id === Number(it.id));
    if (!p) return res.status(400).json({ error: 'Produto inválido.' });
    const qty = Math.max(1, Math.min(10, Number(it.qty) || 1));
    total += p.price * qty;
    orderItems.push({ productId: p.id, name: p.name, price: p.price, qty });
  }

  if (user.balance < total) {
    return res.status(400).json({ error: `Saldo insuficiente. Necessário R$ ${total.toFixed(2)}. Seu saldo: R$ ${user.balance.toFixed(2)}.`, needTopup: true });
  }

  user.balance -= total;
  write(files.users, users);

  const order = {
    id: 'ORD-' + Date.now(),
    userId: user.id,
    items: orderItems,
    total,
    status: 'Aguardando entrega',
    createdAt: new Date().toISOString()
  };
  const orders = read(files.orders);
  orders.push(order);
  write(files.orders, orders);

  res.json({ success: true, order });
});

// Simulação de adicionar saldo (para testes)
app.post('/api/topup', authRequired, (req, res) => {
  const { amount } = req.body;
  const val = Number(amount);
  if (!val || val <= 0 || val > 1000) return res.status(400).json({ error: 'Valor inválido (1–1000).' });
  const users = read(files.users);
  const user = users.find(u => u.id === req.user.id);
  user.balance += val;
  write(files.users, users);
  res.json({ success: true, balance: user.balance });
});

// ============ ATENDIMENTO / TICKETS ============

app.post('/api/tickets', authRequired, (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) return res.status(400).json({ error: 'Preencha assunto e mensagem.' });
  if (subject.length > 100 || message.length > 2000) return res.status(400).json({ error: 'Texto muito longo.' });

  const tickets = read(files.tickets);
  const ticket = {
    id: 'TK-' + Date.now(),
    userId: req.user.id,
    username: req.user.username,
    subject,
    status: 'Aberto',
    messages: [{ from: 'user', text: message, at: new Date().toISOString() }],
    createdAt: new Date().toISOString()
  };
  tickets.push(ticket);
  write(files.tickets, tickets);
  res.json({ success: true, ticket });
});

app.get('/api/tickets', authRequired, (req, res) => {
  const tickets = read(files.tickets).filter(t => t.userId === req.user.id);
  res.json(tickets);
});

app.get('/api/tickets/:id', authRequired, (req, res) => {
  const t = read(files.tickets).find(x => x.id === req.params.id && x.userId === req.user.id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  res.json(t);
});

app.post('/api/tickets/:id/reply', authRequired, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Mensagem vazia.' });
  const tickets = read(files.tickets);
  const t = tickets.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  t.messages.push({ from: 'user', text: message, at: new Date().toISOString() });
  if (t.status === 'Resolvido') t.status = 'Aberto';
  write(files.tickets, tickets);
  res.json({ success: true, ticket: t });
});

// ============ PÁGINAS ============

const pages = {
  '/': 'index.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/dashboard': 'dashboard.html',
  '/cart': 'cart.html',
  '/support': 'support.html',
  '/ticket': 'ticket.html'
};
Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
});

app.listen(PORT, () => console.log(`✅ YumiStore rodando em http://localhost:${PORT}`));
