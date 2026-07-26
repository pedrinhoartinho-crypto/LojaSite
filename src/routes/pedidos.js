const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = Router();

const MAX_INCREMENT = parseInt(process.env.ORDER_VALUE_INCREMENT_MAX_CENTS) || 90;
const EXPIRATION_MINUTES = parseInt(process.env.ORDER_EXPIRATION_MINUTES) || 1440;

async function calcularValorFinal(subtotal) {
  const centavosBase = Math.round(subtotal * 100);

  db.limparPedidosExpirados(EXPIRATION_MINUTES);

  const pendentes = db.listarPedidosPendentesPorSubtotal(centavosBase);
  const incrementosUsados = new Set(pendentes.map(p => p.incremento_centavos));

  let incremento = 1;
  while (incrementosUsados.has(incremento)) {
    incremento++;
  }
  if (incremento > MAX_INCREMENT) {
    throw new Error('Muitos pedidos pendentes com o mesmo valor. Tente novamente mais tarde.');
  }

  const valorFinalCentavos = centavosBase + incremento;
  return {
    valorFinal: valorFinalCentavos / 100,
    incrementoCentavos: incremento,
    centavosBase
  };
}

router.post('/', async (req, res) => {
  try {
    const { produto_id, usuario_nome, usuario_email, quantidade } = req.body;

    if (!produto_id) return res.status(400).json({ error: 'produto_id obrigatorio' });
    if (!usuario_email) return res.status(400).json({ error: 'usuario_email obrigatorio' });

    const produto = db.buscarProduto(produto_id);
    if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });

    const qtd = produto.tipo === 'armas' ? (parseInt(quantidade) || 1) : 1;
    const subtotal = produto.preco * qtd;

    const { valorFinal, incrementoCentavos, centavosBase } = await calcularValorFinal(subtotal);

    const pedidoNumero = uuidv4().slice(0, 8).toUpperCase();
    const expiraEm = new Date(Date.now() + EXPIRATION_MINUTES * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');

    const pedidoId = db.criarPedido({
      usuario_nome: usuario_nome || '',
      usuario_email,
      produto_id: produto.id,
      produto_nome: produto.nome,
      produto_tipo: produto.tipo,
      item_nome: produto.item_nome,
      item_quantidade: qtd,
      valor: subtotal,
      valor_final: valorFinal,
      subtotal_centavos: centavosBase,
      incremento_centavos: incrementoCentavos,
      pedido_numero: pedidoNumero,
      expira_em: expiraEm
    });

    const pixKey = process.env.PIX_KEY || 'sua-chave-pix-aqui';
    const pixKeyType = process.env.PIX_KEY_TYPE || 'aleatoria';
    const receiverName = process.env.PIX_RECEIVER_NAME || 'Bela Vista Roleplay';

    res.json({
      pedido_id: pedidoId,
      pedido_numero: pedidoNumero,
      usuario_email: usuario_email,
      produto: produto.nome,
      tipo: produto.tipo,
      quantidade: qtd,
      subtotal: subtotal,
      valor_final: valorFinal,
      incremento_centavos: incrementoCentavos,
      expira_em: expiraEm,
      pix: {
        chave: pixKey,
        tipo: pixKeyType,
        recebedor: receiverName
      }
    });
  } catch (e) {
    console.error('[PEDIDOS] Erro:', e);
    res.status(500).json({ error: e.message || 'Erro interno' });
  }
});

router.get('/email/:email', (req, res) => {
  const emailParam = req.params.email;
  const emailQuery = req.query.email || '';

  if (!emailQuery || emailQuery.toLowerCase() !== decodeURIComponent(emailParam).toLowerCase()) {
    return res.status(403).json({ error: 'Email nao confere' });
  }

  const pedidos = db.listarPedidosPorEmail(decodeURIComponent(emailParam));
  res.json({ pedidos });
});

router.get('/:numero', (req, res) => {
  const pedido = db.buscarPedidoPorNumero(req.params.numero);
  if (!pedido) return res.status(404).json({ error: 'Pedido nao encontrado' });

  const email = req.query.email || '';
  if (!email || email.toLowerCase() !== pedido.usuario_email.toLowerCase()) {
    return res.status(403).json({ error: 'Email nao confere com o pedido', precisa_email: true });
  }

  res.json({
    pedido: {
      id: pedido.id,
      numero: pedido.pedido_numero,
      produto: pedido.produto_nome,
      tipo: pedido.produto_tipo,
      quantidade: pedido.item_quantidade,
      valor: pedido.valor,
      valor_final: pedido.valor_final || pedido.valor,
      status: pedido.status,
      chave: pedido.chave_gerada || null,
      criado_em: pedido.criado_em,
      expira_em: pedido.expira_em,
      pix: pedido.status === 'pendente' ? {
        chave: process.env.PIX_KEY || 'sua-chave-pix-aqui',
        tipo: process.env.PIX_KEY_TYPE || 'aleatoria',
        recebedor: process.env.PIX_RECEIVER_NAME || 'Bela Vista Roleplay'
      } : null
    }
  });
});

module.exports = router;
