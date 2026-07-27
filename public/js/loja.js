let produtos = [];
let pedidoAtual = null;

const icones = {
  dinheiro: '💰',
  armas: '🔫',
  carros: '🚗'
};

async function carregarProdutos() {
  try {
    const res = await fetch('/api/produtos');
    const data = await res.json();
    produtos = data.produtos;
    renderizarProdutos(produtos);
  } catch (e) {
    document.getElementById('produtos').innerHTML = '<p style="text-align:center;color:var(--cinza-400)">Erro ao carregar produtos</p>';
  }
}

function renderizarProdutos(lista) {
  const grid = document.getElementById('produtos');
  if (lista.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:var(--cinza-400);grid-column:1/-1">Nenhum produto encontrado</p>';
    return;
  }

  grid.innerHTML = lista.map(p => {
    const img = p.imagem_url ? `<img src="${p.imagem_url}" alt="${p.nome}" style="width:70px;height:70px;object-fit:cover;border-radius:50%;margin:0 auto 15px;display:block">` : `<div class="produto-icone">${icones[p.tipo] || '🎁'}</div>`;
    return `
    <div class="produto-card" onclick="abrirCompra(${p.id})">
      ${img}
      <h3>${p.nome}</h3>
      <p>${p.descricao}</p>
      <span class="produto-tipo">${p.tipo}</span>
      <div class="produto-preco">R$ ${p.preco.toFixed(2)}</div>
      ${p.tipo === 'armas' ? '<div style="font-size:12px;color:var(--laranja-300);margin-bottom:10px">Preco unitario</div>' : ''}
      <button class="produto-btn">Comprar</button>
    </div>
  `}).join('');
}

function filtrar(tipo) {
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
  event.target.classList.add('ativo');

  if (tipo === 'todos') renderizarProdutos(produtos);
  else renderizarProdutos(produtos.filter(p => p.tipo === tipo));
}

function abrirCompra(produtoId) {
  const produto = produtos.find(p => p.id === produtoId);
  if (!produto) return;

  const modal = document.getElementById('modal');
  const conteudo = document.getElementById('modal-conteudo');

  const temQuantidade = produto.tipo === 'armas';

  let qtdHtml = '';
  if (temQuantidade) {
    qtdHtml = `
      <label>Quantidade</label>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:15px">
        <button type="button" onclick="mudarQtd(-1)" style="background:var(--cinza-700);color:var(--branco);border:none;width:36px;height:36px;border-radius:8px;font-size:18px;cursor:pointer;font-weight:700">&minus;</button>
        <input type="number" id="input-qtd" value="1" min="1" max="99" style="text-align:center;width:60px;margin-bottom:0" readonly>
        <button type="button" onclick="mudarQtd(1)" style="background:var(--cinza-700);color:var(--branco);border:none;width:36px;height:36px;border-radius:8px;font-size:18px;cursor:pointer;font-weight:700">+</button>
        <span id="subtotal-exibicao" style="color:var(--laranja-500);font-weight:700;font-size:16px">R$ ${produto.preco.toFixed(2)}</span>
      </div>
    `;
  }

  conteudo.innerHTML = `
    <h2>${icones[produto.tipo]} ${produto.nome}</h2>
    <p style="color:var(--cinza-200);margin-bottom:20px">${produto.descricao}</p>
    <p style="font-size:24px;font-weight:800;color:var(--laranja-500);margin-bottom:20px;text-align:center">R$ ${produto.preco.toFixed(2)} ${temQuantidade ? 'cada' : ''}</p>
    <form id="form-compra">
      <label>Seu Nome (opcional)</label>
      <input type="text" id="input-nome" placeholder="Seu nome no jogo" maxlength="50">
      <label>Seu Email *</label>
      <input type="email" id="input-email" placeholder="seu@email.com" required>
      ${qtdHtml}
      <div class="erro-msg" id="erro-email">Email invalido</div>
      <button type="submit" class="modal-btn" id="btn-comprar">Gerar Pagamento</button>
    </form>
  `;

  window._produtoAtual = produto.preco;

  modal.classList.add('ativo');

  document.getElementById('form-compra').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('input-email').value.trim();
    const nome = document.getElementById('input-nome').value.trim();
    const qtd = temQuantidade ? parseInt(document.getElementById('input-qtd')?.value || '1') : 1;
    const btn = document.getElementById('btn-comprar');

    if (!email || !email.includes('@')) {
      document.getElementById('erro-email').style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Processando...';

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto_id: produtoId, usuario_nome: nome, usuario_email: email, quantidade: qtd })
      });

      const data = await res.json();

      localStorage.setItem('bvr_email', data.usuario_email || email);

      if (!data.pix) {
        conteudo.innerHTML = `<p style="color:#ff4444">Erro ao gerar pedido</p>`;
        return;
      }

      const minutos = Math.floor((new Date(data.expira_em + 'Z') - new Date()) / 60000) || 30;

      conteudo.innerHTML = `
        <div class="modal-info">
          <div style="font-size:40px;margin-bottom:10px">🧾</div>
          <h2 style="color:var(--laranja-500);margin-bottom:5px">Pagamento via Pix</h2>
          <p style="color:var(--cinza-200);font-size:13px;margin-bottom:5px">Pedido #${data.pedido_numero}</p>
          <div style="display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:15px">
            ${data.imagem_url ? `<img src="${data.imagem_url}" style="width:40px;height:40px;border-radius:8px;object-fit:cover">` : ''}
            <p style="color:var(--cinza-200);font-size:13px">${data.produto} ${data.tipo === 'armas' ? 'x' + data.quantidade : ''}</p>
          </div>

          <div style="background:var(--cinza-800);border:2px dashed var(--laranja-600);border-radius:12px;padding:20px;margin:15px 0">
            <p style="color:var(--cinza-200);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Pague exatamente</p>
            <p style="font-size:36px;font-weight:900;color:var(--laranja-500);letter-spacing:2px">R$ ${data.valor_final.toFixed(2)}</p>
            <p style="color:var(--laranja-300);font-size:13px;margin-top:5px">Incremento: +R$ 0,${String(data.incremento_centavos).padStart(2, '0')}</p>
          </div>

          <div style="background:var(--cinza-900);border:1px solid var(--cinza-700);border-radius:8px;padding:15px;margin:10px 0;text-align:left">
            <p style="color:var(--cinza-400);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Chave Pix</p>
            <p style="color:var(--branco);font-size:16px;font-weight:600;word-break:break-all">${data.pix.chave}</p>
            <p style="color:var(--cinza-400);font-size:11px;margin-top:5px">Tipo: ${data.pix.tipo} | Recebedor: ${data.pix.recebedor}</p>
          </div>

          <p style="color:var(--cinza-400);font-size:12px">O pedido expira em ${minutos} minutos.</p>
          <p style="color:var(--cinza-400);font-size:12px;margin-bottom:15px">Apos pagar, aguarde a confirmacao do admin.</p>

          <div style="display:flex;gap:10px">
            <button class="modal-btn" onclick="verPedido('${data.pedido_numero}')" style="flex:1">Ver Pedido</button>
            <button class="modal-btn" onclick="copiarChavePix()" style="flex:1;background:var(--cinza-700);background-image:none">Copiar Chave</button>
          </div>
        </div>
      `;
      window._pixChave = data.pix.chave;
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Gerar Pagamento';
      document.getElementById('erro-email').textContent = 'Erro ao processar. Tente novamente.';
      document.getElementById('erro-email').style.display = 'block';
    }
  });
}

function mudarQtd(delta) {
  const input = document.getElementById('input-qtd');
  const sub = document.getElementById('subtotal-exibicao');
  if (!input || !sub) return;
  let v = parseInt(input.value) || 1;
  v = Math.max(1, Math.min(99, v + delta));
  input.value = v;
  const preco = window._produtoAtual || 0;
  sub.textContent = `R$ ${(preco * v).toFixed(2)}`;
}

function copiarChavePix() {
  if (window._pixChave) {
    navigator.clipboard?.writeText(window._pixChave);
    const btn = event?.target;
    if (btn) { const t = btn.textContent; btn.textContent = 'Copiado!'; setTimeout(() => btn.textContent = t, 2000); }
  }
}

function verPedido(numero) {
  fecharModal();
  window.location.href = `/pedido/${numero}`;
}

function emailSalvo() {
  return localStorage.getItem('bvr_email') || '';
}

function pedirEmail(callback) {
  const modal = document.getElementById('modal');
  const conteudo = document.getElementById('modal-conteudo');
  const saved = emailSalvo();

  conteudo.innerHTML = `
    <h2>🔐 Verificar Email</h2>
    <p style="color:var(--cinza-200);margin-bottom:20px">Informe seu email para acessar seus pedidos.</p>
    <form id="form-email">
      <label>Seu Email</label>
      <input type="email" id="input-verificar-email" value="${saved}" placeholder="seu@email.com" required>
      <div class="erro-msg" id="erro-email-check" style="display:none">Email invalido</div>
      <button type="submit" class="modal-btn">Continuar</button>
    </form>
  `;
  modal.classList.add('ativo');

  document.getElementById('form-email').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('input-verificar-email').value.trim();
    if (!email || !email.includes('@')) {
      document.getElementById('erro-email-check').style.display = 'block';
      return;
    }
    localStorage.setItem('bvr_email', email);
    modal.classList.remove('ativo');
    if (callback) callback(email);
  });
}

function mostrarPedidos() {
  const email = emailSalvo();
  if (email) {
    listarPedidosPorEmail(email);
  } else {
    pedirEmail((e) => listarPedidosPorEmail(e));
  }
}

async function listarPedidosPorEmail(email) {
  const modal = document.getElementById('modal');
  const conteudo = document.getElementById('modal-conteudo');
  conteudo.innerHTML = '<p style="text-align:center;color:var(--cinza-400);padding:30px">Carregando...</p>';
  modal.classList.add('ativo');

  try {
    const res = await fetch(`/api/pedidos/email/${encodeURIComponent(email)}?email=${encodeURIComponent(email)}`);
    if (res.status === 403) {
      conteudo.innerHTML = `<p style="color:#ff4444;text-align:center;padding:20px">Acesso negado. Email invalido.</p>`;
      return;
    }
    const data = await res.json();
    const pedidos = data.pedidos || [];

    if (pedidos.length === 0) {
      conteudo.innerHTML = `
        <div class="modal-info">
          <h2 style="color:var(--laranja-500)">Meus Pedidos</h2>
          <p style="color:var(--cinza-400);margin:20px 0">Nenhum pedido encontrado para <strong>${email}</strong></p>
          <button class="modal-btn" onclick="fecharModal()">Fechar</button>
        </div>
      `;
      return;
    }

    let html = `
      <h2 style="color:var(--laranja-500);margin-bottom:15px">Meus Pedidos</h2>
      <p style="color:var(--cinza-400);font-size:13px;margin-bottom:15px">${email}</p>
      <div class="pedidos-lista" style="max-height:400px;overflow-y:auto">
    `;

    for (const p of pedidos) {
      const stCls = p.status === 'concluido' ? 'concluido' : p.status === 'pendente' ? 'pendente' : 'expirado';
      const stTxt = p.status.charAt(0).toUpperCase() + p.status.slice(1);
      html += `
        <div class="pedido-item" onclick="verPedido('${p.pedido_numero}')" style="cursor:pointer">
          <div class="pedido-item-info">
            <h4>${p.produto_nome} ${p.item_quantidade > 1 && p.produto_tipo === 'armas' ? 'x' + p.item_quantidade : ''}</h4>
            <span>#${p.pedido_numero || p.id} - ${new Date(p.criado_em + 'Z').toLocaleString('pt-BR')}</span>
          </div>
          <div class="pedido-item-status">
            <span class="status-badge ${stCls}" style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase">${stTxt}</span>
            <div style="color:var(--laranja-500);font-weight:700;font-size:14px;margin-top:5px">R$ ${(p.valor_final || p.valor).toFixed(2)}</div>
          </div>
        </div>
      `;
    }

    html += '</div><button class="modal-btn" onclick="fecharModal()" style="margin-top:15px">Fechar</button>';
    conteudo.innerHTML = html;
  } catch (e) {
    conteudo.innerHTML = '<p style="color:#ff4444">Erro ao carregar pedidos</p>';
  }
}

async function buscarPedido(numero, isModal = false) {
  const container = document.getElementById(isModal ? 'modal-conteudo' : 'pedido-container');
  if (!isModal) container.innerHTML = '<div class="carregando">Buscando pedido...</div>';

  const email = emailSalvo();
  if (!email) {
    if (isModal) {
      pedirEmail((e) => buscarPedido(numero, true));
    } else {
      container.innerHTML = `
        <div class="pedido-card">
          <h2>🔐 Verificar Acesso</h2>
          <p style="color:var(--cinza-200);margin:15px 0">Informe seu email para ver o pedido.</p>
          <form id="form-email-pedido">
            <input type="email" id="input-email-pedido" placeholder="seu@email.com" required style="width:100%;padding:12px 15px;background:var(--cinza-800);border:1px solid var(--cinza-600);border-radius:8px;color:var(--branco);font-size:15px;margin-bottom:10px">
            <button type="submit" class="modal-btn">Ver Pedido</button>
          </form>
        </div>
      `;
      document.getElementById('form-email-pedido')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const em = document.getElementById('input-email-pedido').value.trim();
        if (em && em.includes('@')) {
          localStorage.setItem('bvr_email', em);
          buscarPedido(numero);
        }
      });
    }
    return;
  }

  try {
    const res = await fetch(`/api/pedidos/${numero}?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (res.status === 403) {
      container.innerHTML = `
        <div class="pedido-card">
          <h2>🔐 Acesso Negado</h2>
          <p style="color:var(--cinza-200);margin:15px 0">Este pedido nao pertence ao email informado.</p>
          <p style="color:var(--cinza-400);font-size:13px;margin-bottom:15px">Email usado: ${email}</p>
          <form id="form-email-trocar">
            <input type="email" id="input-email-trocar" placeholder="Outro email?" required style="width:100%;padding:12px 15px;background:var(--cinza-800);border:1px solid var(--cinza-600);border-radius:8px;color:var(--branco);font-size:15px;margin-bottom:10px">
            <button type="submit" class="modal-btn">Tentar</button>
          </form>
        </div>
      `;
      document.getElementById('form-email-trocar')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const em = document.getElementById('input-email-trocar').value.trim();
        if (em && em.includes('@')) {
          localStorage.setItem('bvr_email', em);
          buscarPedido(numero);
        }
      });
      return;
    }

    if (!data.pedido) {
      container.innerHTML = '<p style="text-align:center;color:var(--cinza-400)">Pedido nao encontrado</p>';
      return;
    }

    const p = data.pedido;
    const statusClass = p.status === 'concluido' ? 'concluido' : p.status === 'pendente' ? 'pendente' : (p.status === 'expirado' ? 'expirado' : 'falhou');
    const statusText = p.status === 'concluido' ? 'Concluido' : p.status === 'pendente' ? 'Pendente' : (p.status === 'expirado' ? 'Expirado' : 'Falhou');

    const html = `
      <div class="pedido-card">
        <h2>${p.status === 'concluido' ? '🎉' : '📋'} Pedido #${p.numero}</h2>
        <div class="pedido-status ${statusClass}">${statusText}</div>

        <div class="pedido-detalhes">
          <p><span>Produto</span><span>
            ${p.imagem_url ? `<img src="${p.imagem_url}" style="width:24px;height:24px;border-radius:4px;object-fit:cover;vertical-align:middle;margin-right:6px">` : ''}
            ${p.produto} ${p.quantidade > 1 ? 'x' + p.quantidade : ''}
          </span></p>
          <p><span>Valor</span><span>R$ ${parseFloat(p.valor_final || p.valor).toFixed(2)}</span></p>
          <p><span>Data</span><span>${new Date(p.criado_em + 'Z').toLocaleString('pt-BR')}</span></p>
        </div>

        ${p.chave ? `
          <div style="margin-top:20px">
            <p style="color:var(--cinza-200);font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Sua Chave</p>
            <div class="chave" style="font-size:18px;padding:12px">${p.chave}</div>
            <p style="color:var(--cinza-400);font-size:12px;margin-top:10px">
              Copie a chave e resgate no jogo pelo menu de Keys.
            </p>
          </div>
        ` : p.status === 'pendente' ? `
          <div style="margin-top:15px">
            <p style="color:var(--laranja-300);margin-bottom:10px">Aguardando confirmacao de pagamento...</p>
            <p style="color:var(--cinza-400);font-size:12px">Pague R$ ${parseFloat(p.valor_final || p.valor).toFixed(2)} via Pix para a chave:</p>
            <div style="background:var(--cinza-800);border:1px solid var(--cinza-600);border-radius:8px;padding:12px;margin-top:8px;word-break:break-all">
              <p style="color:var(--laranja-300);font-weight:600;font-size:14px">${p.pix?.chave || '---'}</p>
              <p style="color:var(--cinza-400);font-size:11px;margin-top:3px">Recebedor: ${p.pix?.recebedor || '---'}</p>
            </div>
          </div>
        ` : ''}

        ${!isModal ? '<a href="/" class="modal-btn" style="display:inline-block;text-decoration:none;margin-top:20px">Voltar a Loja</a>' : ''}
      </div>
    `;

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p style="text-align:center;color:#ff4444">Erro ao buscar pedido</p>';
  }
}

function fecharModal() {
  document.getElementById('modal').classList.remove('ativo');
}

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) fecharModal();
});

document.addEventListener('DOMContentLoaded', carregarProdutos);
