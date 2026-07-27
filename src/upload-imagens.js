const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'https://loja-belavista.onrender.com';
const TOKEN = 'BELA_VISTA_ROLEPLAY';

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
const dbPath = path.join(__dirname, '..', 'loja.db');

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + urlPath);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }
    };
    if (body) opts.headers['Content-Type'] = 'application/json';
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

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + '/api/admin/produtos/0/upload-imagem');
    const boundary = '----' + Math.random().toString(36).slice(2);
    const file = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    let body = '';
    body += '--' + boundary + '\r\n';
    body += 'Content-Disposition: form-data; name="imagem"; filename="' + fileName + '"\r\n';
    body += 'Content-Type: image/png\r\n\r\n';

    const buf = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      file,
      Buffer.from('\r\n--' + boundary + '--\r\n', 'utf-8')
    ]);

    const opts = {
      hostname: u.hostname,
      path: '/api/admin/produtos/0/upload-imagem',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': buf.length
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
    req.write(buf);
    req.end();
  });
}

async function main() {
  console.log('Buscando produtos do Render...');
  const data = await request('GET', '/api/admin/produtos');
  const produtos = data.produtos.filter(p => p.ativo);
  console.log(produtos.length + ' produtos ativos encontrados.');

  for (const p of produtos) {
    const localDbStmt = new (require('sql.js'))();
    const buf = fs.readFileSync(dbPath);
    const db = new localDbStmt.Database(buf);
    const stmt = db.prepare('SELECT imagem_url FROM produtos WHERE id = ?');
    stmt.bind([p.id]);
    let url = '';
    if (stmt.step()) url = stmt.getAsObject().imagem_url || '';
    stmt.free();
    db.close();

    if (!url) continue;
    const fileName = path.basename(url);
    const filePath = path.join(uploadsDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.log('  [' + p.id + '] ' + p.nome + ' -> imagem ' + fileName + ' nao encontrada localmente');
      continue;
    }

    console.log('  [' + p.id + '] ' + p.nome + ' -> enviando ' + fileName + '...');
    const result = await uploadImage(filePath);

    if (result && result.imagem_url) {
      await request('PATCH', '/api/admin/produtos/' + p.id, { imagem_url: result.imagem_url });
      console.log('    OK: ' + result.imagem_url);
    } else {
      console.log('    ERRO: ' + JSON.stringify(result));
    }
  }

  console.log('Finalizado!');
  process.exit(0);
}

main();
