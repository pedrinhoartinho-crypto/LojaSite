const db = require('./database');

const produtos = [
  ...armas(),
  ...carros(),
  ...dinheiro()
];

function armas() {
  const lista = [
    ['Glock', 4.00, '/uploads/1785094645039-8s2a9r.png'],
    ['Uzi', 5.00, '/uploads/1785094490373-m3qecd.png'],
    ['MT40', 6.00, '/uploads/1785095351696-bskl82.png'],
    ['PistolaJapan', 6.00, '/uploads/1785094689036-36gw0c.png'],
    ['PistolaSilenciada', 7.00, '/uploads/1785094702765-31sjqh.png'],
    ['AK47', 8.00, '/uploads/1785094728061-yyx4sn.png'],
    ['AR15', 8.00, '/uploads/1785094747994-ra1jij.png'],
    ['M4A1', 8.00, '/uploads/1785094771922-bcujwp.png'],
    ['IA2', 8.00, '/uploads/1785095160634-ih4b2x.png'],
    ['FuzilHey', 10.00, '/uploads/1785094808158-gnsnbh.png'],
    ['FuzilPinkGlitch', 12.00, '/uploads/1785094820013-1atlvm.png'],
    ['FuzilRedPhantom', 12.00, '/uploads/1785094835889-rfimmn.png'],
  ];
  return lista.map(([nome, preco, img]) => ({
    nome, descricao: `Arma ${nome}`,
    tipo: 'armas', item_nome: nome, item_quantidade: 1, preco, imagem_url: img
  }));
}

function carros() {
  const lista = [
    ['MK4', 12.00, 'Toyota Supra Mk4', '/uploads/1785096045931-ls4tym.png'],
    ['Mecha GT', 13.00, 'esportivo generico', '/uploads/1785096058566-23uedj.png'],
    ['BWX N4', 15.00, 'BMW linha esportiva M4', '/uploads/1785096073773-z5ohke.png'],
    ['X7', 18.00, 'BMW X7 SUV de luxo', '/uploads/1785096093465-8ye106.png'],
    ['Cybertruck', 22.00, 'Tesla Cybertruck', '/uploads/1785096105418-b6cd84.png'],
    ['Nison GTX', 30.00, 'Nissan GT-R', '/uploads/1785096117697-mgyenr.png'],
    ['458', 32.00, 'Ferrari 458', '/uploads/1785096129700-w7ob67.png'],
    ['Aston', 34.00, 'Aston Martin', '/uploads/1785096139947-dyhjx4.png'],
    ['Purosangue', 40.00, 'Ferrari Purosangue hiper-SUV', '/uploads/1785096151307-z2pvg8.png'],
  ];
  return lista.map(([nome, preco, desc, img]) => ({
    nome: nome, descricao: desc,
    tipo: 'carros', item_nome: nome, item_quantidade: 1, preco, imagem_url: img
  }));
}

function dinheiro() {
  const lista = [
    ['Pacote P', 10000, 4.00, '/uploads/1785095525477-jzrzzr.png'],
    ['Pacote M', 25000, 8.00, '/uploads/1785095541614-e5bf88.png'],
    ['Pacote G', 60000, 15.00, '/uploads/1785095556147-2z1buw.png'],
    ['Pacote GG', 175000, 35.00, '/uploads/1785095572232-jgyjt5.png'],
    ['Pacote Maximo', 400000, 70.00, '/uploads/1785095583978-n1tz1c.png'],
  ];
  return lista.map(([nome, amount, preco, img]) => ({
    nome, descricao: `Receba R$ ${Number(amount).toLocaleString('pt-BR')} no jogo`,
    tipo: 'dinheiro', item_nome: null, item_quantidade: amount, preco, imagem_url: img
  }));
}

async function seedDatabase() {
  db.db.run('DELETE FROM produtos');
  db.db.run("DELETE FROM sqlite_sequence WHERE name='produtos'");

  const stmt = db.db.prepare(`
    INSERT INTO produtos (nome, descricao, tipo, item_nome, item_quantidade, preco, imagem_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of produtos) {
    stmt.run([p.nome, p.descricao, p.tipo, p.item_nome || null, p.item_quantidade || 1, p.preco, '']);
  }
  stmt.free();

  const data = db.db.export();
  const buffer = Buffer.from(data);
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, '..', 'loja.db'), buffer);

  console.log(`[SEED] ${produtos.length} produtos inseridos!`);
}

if (require.main === module) {
  require('dotenv').config();
  db.init().then(() => {
    seedDatabase().then(() => process.exit(0));
  });
}

module.exports = seedDatabase;
