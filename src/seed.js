require('dotenv').config();
const db = require('./database');

const produtos = [
  ...armas(),
  ...carros(),
  ...dinheiro()
];

function armas() {
  const lista = [
    ['Glock', 4.00],
    ['Uzi', 5.00],
    ['MT40', 6.00],
    ['PistolaJapan', 6.00],
    ['PistolaSilenciada', 7.00],
    ['AK47', 8.00],
    ['AR15', 8.00],
    ['M4A1', 8.00],
    ['IA2', 8.00],
    ['FuzilHey', 10.00],
    ['FuzilPinkGlitch', 12.00],
    ['FuzilRedPhantom', 12.00],
  ];
  return lista.map(([nome, preco]) => ({
    nome, descricao: `Arma ${nome}`,
    tipo: 'armas', item_nome: nome, item_quantidade: 1, preco
  }));
}

function carros() {
  const lista = [
    ['MK4', 12.00, 'Toyota Supra Mk4'],
    ['Mecha GT', 13.00, 'esportivo generico'],
    ['BWX N4', 15.00, 'BMW linha esportiva M4'],
    ['X7', 18.00, 'BMW X7 SUV de luxo'],
    ['Cybertruck', 22.00, 'Tesla Cybertruck'],
    ['Nison GTX', 30.00, 'Nissan GT-R'],
    ['458', 32.00, 'Ferrari 458'],
    ['Aston', 34.00, 'Aston Martin'],
    ['Purosangue', 40.00, 'Ferrari Purosangue hiper-SUV'],
  ];
  return lista.map(([nome, preco, desc]) => ({
    nome: nome, descricao: desc,
    tipo: 'carros', item_nome: nome, item_quantidade: 1, preco
  }));
}

function dinheiro() {
  const lista = [
    ['Pacote P', 10000, 4.00],
    ['Pacote M', 25000, 8.00],
    ['Pacote G', 60000, 15.00],
    ['Pacote GG', 175000, 35.00],
    ['Pacote Maximo', 400000, 70.00],
  ];
  return lista.map(([nome, amount, preco]) => ({
    nome, descricao: `Receba R$ ${Number(amount).toLocaleString('pt-BR')} no jogo`,
    tipo: 'dinheiro', item_nome: null, item_quantidade: amount, preco
  }));
}

async function run() {
  await db.init();

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
  process.exit(0);
}

run();
