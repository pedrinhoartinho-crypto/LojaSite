const https = require('https');
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
    const req = https.request(opts, res => {
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
  const localDb = new SQL.Database(buffer);

  const stmt = localDb.prepare('SELECT id, nome, imagem_url FROM produtos WHERE imagem_url != ""');
  const locais = [];
  while (stmt.step()) locais.push(stmt.getAsObject());
  stmt.free();
  localDb.close();

  const data = await request('GET', '/api/admin/produtos');
  const remotos = data.produtos;

  console.log('Locais com imagem:', locais.length, '| Render:', remotos.length, 'produtos');

  for (const l of locais) {
    const fileName = path.basename(l.imagem_url);
    const localFile = path.join(__dirname, '..', 'public', 'uploads', fileName);
    if (!fs.existsSync(localFile)) {
      console.log('  ' + l.nome + ' -> imagem nao encontrada: ' + fileName);
      continue;
    }

    const r = remotos.find(p => p.nome === l.nome);
    if (!r) {
      console.log('  ' + l.nome + ' -> nao encontrado no Render');
      continue;
    }

    const imgUrl = '/uploads/' + fileName;
    console.log('  [' + r.id + '] ' + l.nome + ' -> ' + imgUrl);
    const result = await request('PATCH', '/api/admin/produtos/' + r.id, { imagem_url: imgUrl });
    console.log('    ' + (result.success ? 'OK' : 'ERRO: ' + JSON.stringify(result)));
  }

  console.log('Finalizado!');
}

main().catch(e => { console.error(e); process.exit(1); });
