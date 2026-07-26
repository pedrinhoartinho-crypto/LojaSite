const API_KEY = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE_NAME = 'SistemaChavesV3';

function openCloudConfigurado() {
  return !!API_KEY && !!UNIVERSE_ID;
}

function gerarChaveAleatoria() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let chave = '';
  for (let i = 0; i < 10; i++) {
    chave += chars[Math.floor(Math.random() * chars.length)];
  }
  return chave;
}

async function gerarEGravarKey(premio) {
  let chave = gerarChaveAleatoria();

  if (openCloudConfigurado()) {
    const https = require('https');

    function requisicao(metodo, entryKey, body) {
      return new Promise((resolve, reject) => {
        const url = new URL(`https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry`);
        url.searchParams.set('datastoreName', DATASTORE_NAME);
        url.searchParams.set('entryKey', entryKey);

        const req = https.request({
          method: metodo,
          hostname: 'apis.roblox.com',
          path: url.pathname + url.search,
          headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try { resolve(data ? JSON.parse(data) : {}); }
              catch { resolve(data); }
            } else {
              reject(new Error(`Open Cloud error ${res.statusCode}: ${data}`));
            }
          });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    }

    try {
      let tentativas = 0;
      while (tentativas < 10) {
        chave = gerarChaveAleatoria();
        tentativas++;
        try {
          await requisicao('GET', chave);
        } catch (e) {
          if (e.message.includes('404')) break;
          if (e.message.includes('400')) break;
        }
      }
      await requisicao('POST', chave, premio);
      console.log('[OPENCLOUD] Key salva no DataStore Roblox:', chave);
    } catch (e) {
      console.warn('[OPENCLOUD] Falha ao salvar no Roblox, usando apenas local:', e.message);
    }
  }

  return chave;
}

module.exports = { gerarEGravarKey, gerarChaveAleatoria, openCloudConfigurado };
