const http = require('http');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const BASE = 'https://loja-belavista.onrender.com';
const TOKEN = 'BELA_VISTA_ROLEPLAY';
const DB_PATH = path.join(__dirname, '..', 'loja.db');

async function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + urlPath);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  const stmt = db.prepare('SELECT id, nome, imagem_url FROM produtos WHERE imagem_url != ""');
  const produtos = [];
  while (stmt.step()) produtos.push(stmt.getAsObject());
  stmt.free();
  db.close();

  console.log('Produtos com imagem no banco local:', produtos.length);

  for (const p of produtos) {
    const fileName = path.basename(p.imagem_url);
    const localFile = path.join(__dirname, '..', 'public', 'uploads', fileName);
    if (!fs.existsSync(localFile)) {
      console.log('  [' + p.id + '] ' + p.nome + ' -> imagem nao encontrada: ' + fileName);
      continue;
    }

    const imgUrl = '/uploads/' + fileName;
    console.log('  [' + p.id + '] ' + p.nome + ' -> ' + imgUrl);
    const result = await request('PATCH', '/api/admin/produtos/' + p.id, { imagem_url: imgUrl });
    if (result.success) {
      console.log('    OK');
    } else {
      console.log('    ERRO: ' + JSON.stringify(result));
    }
  }

  console.log('Finalizado!');
}

main().catch(e => { console.error(e); process.exit(1); });
