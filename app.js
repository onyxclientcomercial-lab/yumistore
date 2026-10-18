// ================= BANCO DE DADOS LOCAL =================
const DB = {
  get(key, fallback = []) { const data = localStorage.getItem('yumi_' + key); return data ? JSON.parse(data) : fallback; },
  set(key, val) { localStorage.setItem('yumi_' + key, JSON.stringify(val)); if (window.broadcastChannel) window.broadcastChannel.postMessage({ key, val }); }
};

window.broadcastChannel = new BroadcastChannel('yumi_sync');
window.broadcastChannel.onmessage = (event) => {
  if (event.data.key === 'orders') renderAdmOrders();
  if (event.data.key === 'products') renderAdmProducts();
};

if (!DB.get('products').length) {
  DB.set('products', [
    { id: 1, title: '50 CAPAS DA OPTIFINE (NFA)', price: 0.55, oldPrice: 10.90, discount: 94, image: 'https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=400&q=80' },
    { id: 2, title: 'MINECRAFT JAVA PREMIUM', price: 29.90, oldPrice: 49.90, discount: 40, image: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=400&q=80' }
  ]);
}

// ================= LOGIN E REGISTRO =================
function login(identifier, password) {
  if ((identifier === 'YumiAdm' || identifier === 'yumiggcomercial@gmail.com') && password === 'fassbinder201432657788') {
    DB.set('session', { role: 'admin', name: 'YumiAdm' });
    return { success: true, role: 'admin' };
  }
  const users = DB.get('users', []);
  const user = users.find(u => (u.email === identifier || u.nick === identifier) && u.password === password);
  if (user) {
    DB.set('session', { role: 'user', name: user.nick });
    return { success: true, role: 'user' };
  }
  return { error: 'Usuário/E-mail ou senha incorretos.' };
}

// Verifica se o e-mail existe de verdade via API do Google (MX Records)
async function validateEmailReal(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) return false;
  const domain = email.split('@')[1];
  try {
    // Consulta os servidores de DNS do Google
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await res.json();
    return data.Answer && data.Answer.length > 0; // Se tiver MX, o domínio de email existe
  } catch (e) {
    return true; // Fallback caso a API falhe
  }
}

// Cria a conta no Banco de Dados
function registerUser(nick, email, password) {
  const users = DB.get('users', []);
  if (users.find(u => u.email === email)) return { error: 'Este e-mail já está cadastrado.' };
  if (users.find(u => u.nick === nick)) return { error: 'Este Nick já está em uso.' };
  
  users.push({ id: Date.now(), nick, email, password });
  DB.set('users', users);
  return { success: true };
}

function logout() { localStorage.removeItem('yumi_session'); window.location.reload(); }
function getSession() { return DB.get('session', null); }

function updateHeaderAuth() {
  const session = getSession();
  const btn = document.getElementById('headerAuthBtn');
  if (btn) {
    if (session) {
      btn.innerHTML = `👤 Olá, ${session.name}`;
      btn.href = session.role === 'admin' ? '#' : 'dashboard.html';
      if (session.role === 'admin') btn.onclick = (e) => { e.preventDefault(); openAdm(); };
    } else {
      btn.innerHTML = 'Entrar'; btn.href = 'login.html';
    }
  }
  const admBtn = document.getElementById('open-adm-btn');
  if (admBtn) admBtn.style.display = (session && session.role === 'admin') ? 'flex' : 'none';
}

// ================= PAINEL ADM (COM EDITAR) =================
function openAdm() { document.getElementById('floating-adm').classList.add('open'); renderAdmOrders(); renderAdmProducts(); }
function closeAdm() { document.getElementById('floating-adm').classList.remove('open'); }
function toggleFullScreenAdm() { document.getElementById('floating-adm').classList.toggle('expanded'); }
function switchAdmTab(tabId, btn) {
  document.querySelectorAll('.adm-section').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.adm-nav button').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
}

function renderAdmOrders() {
  const list = document.getElementById('adm-orders-list');
  if (!list) return;
  const orders = DB.get('orders', []);
  if (!orders.length) { list.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma compra pendente.</p>'; return; }
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

// LISTAR PRODUTOS COM BOTÕES DE EDITAR E EXCLUIR
function renderAdmProducts() {
  const list = document.getElementById('adm-product-list');
  if (!list) return;
  list.innerHTML = DB.get('products', []).map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee; font-size:0.9rem;">
      <div style="flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">
        <span style="color:#333; font-weight:bold;">${p.title}</span><br>
        <small style="color:#666;">R$ ${p.price.toFixed(2)}</small>
      </div>
      <div style="display:flex; gap:5px;">
        <button class="adm-btn-edit" onclick="editProduct(${p.id})">Editar</button>
        <button class="adm-btn-delete" onclick="deleteProduct(${p.id})">Excluir</button>
      </div>
    </div>
  `).join('');
}

// CRIAR OU EDITAR PRODUTO
function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('p-id').value;
  const products = DB.get('products', []);
  
  const productData = {
    id: id ? parseInt(id) : Date.now(),
    title: document.getElementById('p-title').value,
    price: parseFloat(document.getElementById('p-price').value),
    image: document.getElementById('p-image').value,
    oldPrice: parseFloat(document.getElementById('p-price').value) * 1.5,
    discount: 30
  };

  if (id) {
    // Editar existente
    const index = products.findIndex(p => p.id === parseInt(id));
    products[index] = { ...products[index], ...productData };
  } else {
    // Criar novo
    products.push(productData);
  }

  DB.set('products', products);
  alert(id ? 'Produto atualizado!' : 'Produto criado!');
  document.getElementById('form-product').reset();
  document.getElementById('p-id').value = '';
  document.getElementById('form-title').innerText = 'Criar Produto';
  renderAdmProducts();
  window.location.reload(); // Recarrega a loja para atualizar
}

function editProduct(id) {
  const p = DB.get('products', []).find(x => x.id === id);
  if (!p) return;
  document.getElementById('p-id').value = p.id;
  document.getElementById('p-title').value = p.title;
  document.getElementById('p-price').value = p.price;
  document.getElementById('p-image').value = p.image;
  document.getElementById('form-title').innerText = 'Editando Produto...';
  document.getElementById('tab-products').scrollIntoView();
}

function deleteProduct(id) {
  if (!confirm('Excluir este produto?')) return;
  DB.set('products', DB.get('products', []).filter(p => p.id !== id));
  renderAdmProducts();
  window.location.reload();
}

// CUPOM
function createCoupon(e) {
  e.preventDefault();
  let baseCode = document.getElementById('c-code').value.toLowerCase();
  const value = document.getElementById('c-value').value;
  if (!baseCode.endsWith(value)) baseCode += value; 
  const coupons = DB.get('coupons', []);
  coupons.push({ code: baseCode, value: value, type: 'percent' });
  DB.set('coupons', coupons);
  alert(`✅ Cupom gerado: ${baseCode} (${value}% OFF)`);
  e.target.reset();
}

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderAuth();
  
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

function addToCart(id) {
  let cart = DB.get('cart', []);
  const item = cart.find(i => i.id === id);
  if (item) item.qty += 1; else cart.push({ id, qty: 1 });
  DB.set('cart', cart);
  alert('Adicionado ao carrinho!');
}
