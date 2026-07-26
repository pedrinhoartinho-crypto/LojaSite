const { Router } = require('express');
const db = require('../database');

const router = Router();

router.get('/', (req, res) => {
  const produtos = db.listarProdutos();
  res.json({ produtos });
});

router.get('/:id', (req, res) => {
  const produto = db.buscarProduto(req.params.id);
  if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });
  res.json({ produto });
});

module.exports = router;
