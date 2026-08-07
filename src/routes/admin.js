const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const opencloud = require('../services/opencloud');
const { adminAuth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) cb(null, true);
    else cb(new Error('Formato invalido. Use PNG, JPG, GIF ou WebP.'));
  }
});

const router = Router();

router.use(adminAuth);

router.get('/pagamentos', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  const stmt = db.db.prepare('SELECT * FROM pedidos ORDER BY criado_em DESC LIMIT ? OFFSET ?');
  stmt.bind([limit, offset]);
  const pedidos = [];
  while (stmt.step()) pedidos.push(stmt.getAsObject());
  stmt.free();

  const countStmt = db.db.prepare('SELECT COUNT(*) as total FROM pedidos');
  countStmt.step();
  const total = countStmt.getAsObject().total;
  countStmt.free();

  const dados = pedidos.map(p => ({
    id: p.id,
    comprador_nome: p.usuario_nome,
    produto_nome: p.produto_nome,
    produto_tipo: p.produto_tipo,
    item_nome: p.item_nome,
    item_quantidade: p.item_quantidade,
    valor: p.valor,
    valor_final: p.valor_final || p.valor,
    subtotal_centavos: p.subtotal_centavos,
    incremento_centavos: p.incremento_centavos || 0,
    status: p.status,
    chave: p.chave_gerada,
    pedido_numero: p.pedido_numero,
    criado_em: p.criado_em,
    expira_em: p.expira_em
  }));

  res.json({ dados, total, page, total_pages: Math.ceil(total / limit) });
});

router.get('/pagamentos/pendentes', (req, res) => {
  const pedidos = db.listarPedidosPendentes();
  const dados = pedidos.map(p => ({
    id: p.id,
    comprador_nome: p.usuario_nome,
    produto_nome: p.produto_nome,
    produto_tipo: p.produto_tipo,
    item_nome: p.item_nome,
    item_quantidade: p.item_quantidade,
    valor: p.valor,
    valor_final: p.valor_final || p.valor,
    subtotal_centavos: p.subtotal_centavos,
    incremento_centavos: p.incremento_centavos || 0,
    pedido_numero: p.pedido_numero,
    criado_em: p.criado_em
  }));
  res.json({ dados });
});

router.post('/confirmar-pagamento', async (req, res) => {
  try {
    const { pedido_id } = req.body;
    if (!pedido_id) return res.status(400).json({ error: 'pedido_id obrigatorio' });

    const pedido = db.buscarPedido(pedido_id);
    if (!pedido) return res.status(404).json({ error: 'Pedido nao encontrado' });
    if (pedido.status !== 'pendente') return res.status(400).json({ error: 'Pedido ja processado' });

    res.json({ ok: true, processando: true });

    setImmediate(async () => {
      try {
        const premio = pedido.produto_tipo === 'dinheiro'
          ? { tipo: 'dinheiro', amount: pedido.item_quantidade }
          : pedido.produto_tipo === 'armas'
          ? { tipo: 'armas', item: pedido.item_nome, quantidade: pedido.item_quantidade || 1 }
          : { tipo: 'carros', car: pedido.item_nome, quantidade: pedido.item_quantidade || 1 };

        const chave = await opencloud.gerarEGravarKey(premio);

        db.registrarKey({
          key: chave,
          produto_id: pedido.produto_id,
          pedido_id: pedido.id,
          tipo: pedido.produto_tipo,
          dados: JSON.stringify(premio)
        });

        const https = require('https');
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
          try {
            const url = new URL(webhookUrl);
            const payload = JSON.stringify({
              embeds: [{
                title: 'PEDIDO ACEITO',
                color: 5814783,
                fields: [
                  { name: 'Cliente', value: pedido.usuario_nome || 'N/A', inline: true },
                  { name: 'Produto', value: pedido.produto_nome + (pedido.item_quantidade > 1 ? ' x' + pedido.item_quantidade : ''), inline: true },
                  { name: 'Pedido #', value: pedido.pedido_numero, inline: true }
                ],
                footer: { text: 'Loja Bela Vista Roleplay' },
                timestamp: new Date().toISOString()
              }]
            });
            const req2 = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } });
            req2.write(payload);
            req2.end();
          } catch (e) {}
        }

        console.log(`[ADMIN] Pagamento confirmado! Key: ${chave} - ${pedido.produto_nome}`);
      } catch (e) {
        console.error('[ADMIN] Erro ao gerar key:', e.message);
        db.atualizarPedido(pedido_id, { status: 'pendente' });
      }
    });
  } catch (e) {
    console.error('[ADMIN] Erro:', e);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/cancelar-pedido', (req, res) => {
  const { pedido_id } = req.body;
  if (!pedido_id) return res.status(400).json({ error: 'pedido_id obrigatorio' });

  const pedido = db.buscarPedido(pedido_id);
  if (!pedido) return res.status(404).json({ error: 'Pedido nao encontrado' });

  if (pedido.chave_gerada) {
    db.db.prepare('DELETE FROM keys_emitidas WHERE pedido_id = ?').run([pedido_id]);
  }
  db.atualizarPedido(pedido_id, { status: 'cancelado', chave_gerada: null });
  res.json({ success: true });

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const https = require('https');
      const url = new URL(webhookUrl);
      const payload = JSON.stringify({
        embeds: [{
          title: 'PEDIDO RECUSADO',
          color: 15548997,
          fields: [
            { name: 'Cliente', value: pedido.usuario_nome || 'N/A', inline: true },
            { name: 'Produto', value: pedido.produto_nome + (pedido.item_quantidade > 1 ? ' x' + pedido.item_quantidade : ''), inline: true },
            { name: 'Pedido #', value: pedido.pedido_numero, inline: true }
          ],
          footer: { text: 'Loja Bela Vista Roleplay' },
          timestamp: new Date().toISOString()
        }]
      });
      const req2 = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } });
      req2.write(payload);
      req2.end();
    } catch (e) {}
  }
});

router.post('/excluir-pedido', (req, res) => {
  const { pedido_id } = req.body;
  if (!pedido_id) return res.status(400).json({ error: 'pedido_id obrigatorio' });

  const pedido = db.buscarPedido(pedido_id);
  if (!pedido) return res.status(404).json({ error: 'Pedido nao encontrado' });

  db.db.prepare('DELETE FROM keys_emitidas WHERE pedido_id = ?').run([pedido_id]);
  db.db.prepare('DELETE FROM pedidos WHERE id = ?').run([pedido_id]);
  const data = db.db.export();
  const buffer = Buffer.from(data);
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, '..', '..', 'loja.db'), buffer);

  res.json({ success: true });
});

router.post('/importar-chave', (req, res) => {
  const { pagamento_id, chave } = req.body;
  if (!pagamento_id || !chave) return res.status(400).json({ error: 'pagamento_id e chave obrigatorios' });

  const pedido = db.buscarPedido(pagamento_id);
  if (!pedido) return res.status(404).json({ error: 'Pedido nao encontrado' });

  const premio = pedido.produto_tipo === 'dinheiro'
    ? { tipo: 'dinheiro', amount: pedido.item_quantidade }
    : pedido.produto_tipo === 'armas'
    ? { tipo: 'armas', item: pedido.item_nome, quantidade: pedido.item_quantidade || 1 }
    : { tipo: 'carros', car: pedido.item_nome, quantidade: pedido.item_quantidade || 1 };

  db.registrarKey({
    key: chave,
    produto_id: pedido.produto_id,
    pedido_id: pagamento_id,
    tipo: pedido.produto_tipo,
    dados: JSON.stringify(premio)
  });

  res.json({ success: true, chave });
});

router.post('/usar-chave', (req, res) => {
  const { chave } = req.body;
  if (!chave) return res.status(400).json({ success: false, error: 'chave obrigatoria' });

  const key = db.buscarKey(chave.toUpperCase());
  if (!key) return res.json({ success: false, error: 'Chave nao encontrada' });
  if (key.usada) return res.json({ success: false, error: 'Chave ja usada' });

  const dados = JSON.parse(key.dados);
  db.marcarKeyUsada(chave.toUpperCase());

  res.json({
    success: true,
    tipo: dados.tipo,
    quantidade: dados.amount || dados.quantidade || 1,
    item_nome: dados.item || dados.car || null
  });

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const https = require('https');
      const url = new URL(webhookUrl);
      const payload = JSON.stringify({
        embeds: [{
          title: 'KEY UTILIZADA',
          color: 16753920,
          fields: [
            { name: 'Tipo', value: dados.tipo, inline: true },
            { name: 'Item', value: dados.item || dados.car || (dados.amount ? 'R$ ' + dados.amount : 'Desconhecido'), inline: true }
          ],
          footer: { text: 'Loja Bela Vista Roleplay' },
          timestamp: new Date().toISOString()
        }]
      });
      const req2 = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } });
      req2.write(payload);
      req2.end();
    } catch (e) {}
  }
});

router.get('/codigos', (req, res) => {
  res.json({ codigos: db.listarCodigos() });
});

router.post('/codigos', (req, res) => {
  const { codigo, desconto } = req.body;
  if (!codigo || !desconto) return res.status(400).json({ error: 'codigo e desconto obrigatorios' });
  if (desconto < 1 || desconto > 100) return res.status(400).json({ error: 'desconto deve ser entre 1 e 100' });
  try {
    const id = db.criarCodigo(codigo, desconto);
    res.json({ success: true, id });
  } catch (e) {
    res.status(400).json({ error: 'Codigo ja existe' });
  }
});

router.patch('/codigos/:id/ativo', (req, res) => {
  db.toggleCodigoAtivo(req.params.id);
  res.json({ success: true });
});

router.get('/pix', (req, res) => {
  res.json({ pix: db.getPixConfig() });
});

router.put('/pix', (req, res) => {
  const { chave, tipo, recebedor } = req.body;
  if (!chave || !tipo || !recebedor) return res.status(400).json({ error: 'chave, tipo e recebedor obrigatorios' });
  db.setPixConfig({ chave: chave.trim(), tipo: tipo.trim(), recebedor: recebedor.trim() });
  res.json({ success: true, pix: db.getPixConfig() });
});

router.post('/gerar-key', async (req, res) => {
  try {
    const { produto_id, quantidade } = req.body;
    if (!produto_id) return res.status(400).json({ error: 'produto_id obrigatorio' });

    const all = db.listarTodosProdutos();
    const produto = all.find(p => p.id == produto_id);
    if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });

    const qtd = produto.tipo === 'armas' ? (parseInt(quantidade) || produto.item_quantidade || 1) : produto.item_quantidade || 1;

    const premio = produto.tipo === 'dinheiro'
      ? { tipo: 'dinheiro', amount: qtd }
      : produto.tipo === 'armas'
      ? { tipo: 'armas', item: produto.item_nome, quantidade: qtd }
      : { tipo: 'carros', car: produto.item_nome, quantidade: qtd };

    const chave = await opencloud.gerarEGravarKey(premio);

    db.registrarKey({
      key: chave,
      produto_id: produto.id,
      pedido_id: 0,
      tipo: produto.tipo,
      dados: JSON.stringify(premio)
    });

    res.json({ success: true, chave, produto: produto.nome });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/produtos', (req, res) => {
  const produtos = db.listarTodosProdutos();
  res.json({ produtos });
});

router.patch('/produtos/:id/ativo', (req, res) => {
  const { id } = req.params;
  const produto = db.buscarProduto(id);
  if (!produto) {
    const all = db.listarTodosProdutos();
    const found = all.find(p => p.id == id);
    if (!found) return res.status(404).json({ error: 'Produto nao encontrado' });
  }
  db.toggleProdutoAtivo(id);
  res.json({ success: true });
});

router.post('/produtos', (req, res) => {
  const { nome, descricao, tipo, item_nome, item_quantidade, preco, imagem_url } = req.body;
  if (!nome || !tipo || !preco) return res.status(400).json({ error: 'nome, tipo e preco obrigatorios' });

  const stmt = db.db.prepare(`
    INSERT INTO produtos (nome, descricao, tipo, item_nome, item_quantidade, preco, imagem_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([nome, descricao || '', tipo, item_nome || null, item_quantidade || 1, preco, imagem_url || '']);
  stmt.free();

  const idStmt = db.db.prepare("SELECT last_insert_rowid() as id");
  idStmt.step();
  const id = idStmt.getAsObject().id;
  idStmt.free();

  const data = db.db.export();
  const buffer = Buffer.from(data);
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, '..', '..', 'loja.db'), buffer);

  res.json({ success: true, id });
});

router.post('/produtos/:id/upload-imagem', upload.single('imagem'), (req, res) => {
  const { id } = req.params;
  const produto = db.buscarProduto(id);
  if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });
  if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatorio' });

  const url = '/uploads/' + req.file.filename;
  db.db.prepare('UPDATE produtos SET imagem_url = ? WHERE id = ?').run([url, id]);
  const data = db.db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, '..', '..', 'loja.db'), buffer);

  res.json({ success: true, imagem_url: url });
});

router.patch('/produtos/:id', (req, res) => {
  const { id } = req.params;
  const { imagem_url, nome, descricao, preco, tipo, item_nome, item_quantidade } = req.body;

  const all = db.listarTodosProdutos();
  const produto = all.find(p => p.id == id);
  if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });

  const campos = {};
  if (imagem_url !== undefined) campos.imagem_url = imagem_url;
  if (nome !== undefined) campos.nome = nome;
  if (descricao !== undefined) campos.descricao = descricao;
  if (preco !== undefined) campos.preco = preco;
  if (tipo !== undefined) campos.tipo = tipo;
  if (item_nome !== undefined) campos.item_nome = item_nome || null;
  if (item_quantidade !== undefined) campos.item_quantidade = item_quantidade;

  if (Object.keys(campos).length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

  const sets = Object.keys(campos).map(k => `${k} = ?`).join(', ');
  const valores = Object.values(campos);
  valores.push(id);
  db.db.prepare(`UPDATE produtos SET ${sets} WHERE id = ?`).run(valores);

  const data = db.db.export();
  const buffer = Buffer.from(data);
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, '..', '..', 'loja.db'), buffer);

  res.json({ success: true });
});

module.exports = router;
