const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'loja.db');

let db;

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL CHECK(tipo IN ('dinheiro','armas','carros')),
      item_nome TEXT,
      item_quantidade INTEGER DEFAULT 1,
      preco REAL NOT NULL,
      imagem_url TEXT DEFAULT '',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_nome TEXT NOT NULL DEFAULT '',
      usuario_email TEXT NOT NULL DEFAULT '',
      produto_id INTEGER NOT NULL,
      produto_nome TEXT NOT NULL,
      produto_tipo TEXT NOT NULL,
      item_nome TEXT,
      item_quantidade INTEGER DEFAULT 1,
      valor REAL NOT NULL,
      valor_final REAL,
      subtotal_centavos INTEGER,
      incremento_centavos INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendente',
      gateway_transacao_id TEXT UNIQUE,
      chave_gerada TEXT,
      pedido_numero TEXT UNIQUE,
      expira_em TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS keys_emitidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      produto_id INTEGER NOT NULL,
      pedido_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      dados TEXT NOT NULL,
      usada INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_pedidos_gateway ON pedidos(gateway_transacao_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_keys_key ON keys_emitidas(key)');

  try { db.run("ALTER TABLE pedidos ADD COLUMN valor_final REAL"); } catch (e) {}
  try { db.run("ALTER TABLE pedidos ADD COLUMN subtotal_centavos INTEGER"); } catch (e) {}
  try { db.run("ALTER TABLE pedidos ADD COLUMN incremento_centavos INTEGER DEFAULT 0"); } catch (e) {}
  try { db.run("ALTER TABLE pedidos ADD COLUMN expira_em TEXT"); } catch (e) {}

  salvar();
  return db;
}

function salvar() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function listarProdutos() {
  const stmt = db.prepare('SELECT * FROM produtos WHERE ativo = 1 ORDER BY preco ASC');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function buscarProduto(id) {
  const stmt = db.prepare('SELECT * FROM produtos WHERE id = ? AND ativo = 1');
  stmt.bind([id]);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free();
  return null;
}

function criarPedido({ usuario_nome, usuario_email, produto_id, produto_nome, produto_tipo, item_nome, item_quantidade, valor, pedido_numero, subtotal_centavos, incremento_centavos, valor_final, expira_em }) {
  const stmt = db.prepare(`
    INSERT INTO pedidos (usuario_nome, usuario_email, produto_id, produto_nome, produto_tipo, item_nome, item_quantidade, valor, pedido_numero, subtotal_centavos, incremento_centavos, valor_final, expira_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([usuario_nome, usuario_email, produto_id, produto_nome, produto_tipo, item_nome || null, item_quantidade || 1, valor, pedido_numero, subtotal_centavos || null, incremento_centavos || 0, valor_final || valor, expira_em || null]);
  stmt.free();
  const id = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  salvar();
  return id;
}

function buscarPedido(id) {
  const stmt = db.prepare('SELECT * FROM pedidos WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free();
  return null;
}

function buscarPedidoPorNumero(numero) {
  const stmt = db.prepare('SELECT * FROM pedidos WHERE pedido_numero = ?');
  stmt.bind([numero]);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free();
  return null;
}

function buscarPedidoPorTransacao(transacaoId) {
  if (!transacaoId) return null;
  const stmt = db.prepare('SELECT * FROM pedidos WHERE gateway_transacao_id = ?');
  stmt.bind([transacaoId]);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free();
  return null;
}

function atualizarPedido(id, campos) {
  const sets = Object.keys(campos).map(k => `${k} = ?`).join(', ');
  const valores = Object.values(campos);
  valores.push(id);
  const stmt = db.prepare(`UPDATE pedidos SET ${sets}, atualizado_em = datetime('now') WHERE id = ?`);
  stmt.run(valores);
  stmt.free();
  salvar();
}

function listarPedidosPendentes() {
  const stmt = db.prepare("SELECT * FROM pedidos WHERE status = 'pendente' AND chave_gerada IS NULL ORDER BY criado_em ASC");
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function listarPedidosPendentesPorSubtotal(centavos) {
  const stmt = db.prepare("SELECT * FROM pedidos WHERE status = 'pendente' AND subtotal_centavos = ? ORDER BY criado_em ASC");
  stmt.bind([centavos]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function limparPedidosExpirados(minutos) {
  const stmt = db.prepare("UPDATE pedidos SET status = 'expirado' WHERE status = 'pendente' AND expira_em IS NOT NULL AND datetime(expira_em) < datetime('now')");
  stmt.run();
  stmt.free();
  salvar();
}

function listarPedidosPorEmail(email) {
  const stmt = db.prepare('SELECT * FROM pedidos WHERE usuario_email = ? ORDER BY criado_em DESC');
  stmt.bind([email]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function listarTodosPedidos(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const stmt = db.prepare('SELECT * FROM pedidos ORDER BY criado_em DESC LIMIT ? OFFSET ?');
  stmt.bind([limit, offset]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  const countStmt = db.prepare('SELECT COUNT(*) as total FROM pedidos');
  countStmt.step();
  const total = countStmt.getAsObject().total;
  countStmt.free();

  return { rows, total };
}

function registrarKey({ key, produto_id, pedido_id, tipo, dados }) {
  const stmt = db.prepare('INSERT INTO keys_emitidas (key, produto_id, pedido_id, tipo, dados) VALUES (?, ?, ?, ?, ?)');
  stmt.run([key, produto_id, pedido_id, tipo, dados]);
  stmt.free();
  atualizarPedido(pedido_id, { chave_gerada: key, status: 'concluido' });
}

function buscarKey(key) {
  const stmt = db.prepare('SELECT * FROM keys_emitidas WHERE key = ?');
  stmt.bind([key]);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free();
  return null;
}

function marcarKeyUsada(key) {
  const stmt = db.prepare('UPDATE keys_emitidas SET usada = 1 WHERE key = ?');
  stmt.run([key]);
  stmt.free();
  salvar();
}

module.exports = {
  get db() { return db; },
  init,
  listarProdutos,
  buscarProduto,
  criarPedido,
  buscarPedido,
  buscarPedidoPorNumero,
  buscarPedidoPorTransacao,
  atualizarPedido,
  listarPedidosPendentes,
  listarPedidosPendentesPorSubtotal,
  listarPedidosPorEmail,
  listarTodosPedidos,
  limparPedidosExpirados,
  registrarKey,
  buscarKey,
  marcarKeyUsada
};
