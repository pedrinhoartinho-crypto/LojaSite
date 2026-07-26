require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas requisicoes. Aguarde um momento.' }
});

app.use('/api/pedidos', limiter);

const produtosRouter = require('./src/routes/produtos');
const pedidosRouter = require('./src/routes/pedidos');
const adminRouter = require('./src/routes/admin');

app.use('/api/produtos', produtosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/admin', adminRouter);

app.get('/pedido/:numero', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pedido.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
    return res.status(404).json({ error: 'Rota nao encontrada' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('==========================================');
    console.log('  BELA VISTA ROLEPLAY - LOJA WEB');
    console.log('  Porta: ' + PORT);
    console.log('==========================================');
  });
});
