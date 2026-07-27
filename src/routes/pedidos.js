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
    const { produto_id, usuario_nome, usuario_email, quantidade, codigo } = req.body;

    if (!produto_id) return res.status(400).json({ error: 'produto_id obrigatorio' });
    if (!usuario_email) return res.status(400).json({ error: 'usuario_email obrigatorio' });

    const produto = db.buscarProduto(produto_id);
    if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });

    const qtd = produto.tipo === 'armas' ? (parseInt(quantidade) || 1) : 1;
    const subtotal = produto.preco * qtd;

    const { valorFinal, incrementoCentavos, centavosBase } = await calcularValorFinal(subtotal);

    let descontoPercentual = 0;
    let codigoUsado = null;
    if (codigo) {
      const cod = db.buscarCodigo(codigo);
      if (cod) {
        descontoPercentual = cod.desconto_percentual;
        codigoUsado = cod.codigo;
      }
    }

    const valorComDesconto = descontoPercentual > 0
      ? Math.round((subtotal + incrementoCentavos / 100) * (1 - descontoPercentual / 100) * 100) / 100
      : valorFinal;

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
      valor_final: valorComDesconto,
      subtotal_centavos: centavosBase,
      incremento_centavos: incrementoCentavos,
      pedido_numero: pedidoNumero,
      expira_em: expiraEm,
      desconto_percentual: descontoPercentual,
      codigo_usado: codigoUsado
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
      valor_final: valorComDesconto,
      incremento_centavos: incrementoCentavos,
      desconto: descontoPercentual || undefined,
      expira_em: expiraEm,
      imagem_url: produto.imagem_url || '',
      pix: {
        chave: pixKey,
        tipo: pixKeyType,
        recebedor: receiverName
      }
    });

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      const https = require('https');
      try {
        const url = new URL(webhookUrl);
        const payload = JSON.stringify({
          embeds: [{
            title: 'NOVO PEDIDO',
            color: 15105570,
            fields: [
              { name: 'Cliente', value: usuario_nome || 'N/A', inline: true },
              { name: 'Email', value: usuario_email, inline: true },
              { name: 'Produto', value: produto.nome + (qtd > 1 ? ' x' + qtd : ''), inline: true },
              { name: 'Valor', value: 'R$ ' + valorComDesconto.toFixed(2) + (descontoPercentual ? ' (' + descontoPercentual + '% off)' : ''), inline: true },
              { name: 'Pedido #', value: pedidoNumero, inline: true },
              { name: 'Status', value: 'Aguardando pagamento', inline: true }
            ],
            footer: { text: 'Loja Bela Vista Roleplay' },
            timestamp: new Date().toISOString()
          }]
        });
        const req2 = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } });
        req2.write(payload);
        req2.end();
      } catch (e) {}
    }
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

  const todos = db.listarTodosProdutos();
  const prod = todos.find(p => p.id === pedido.produto_id);
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
      imagem_url: prod ? prod.imagem_url : '',
      pix: pedido.status === 'pendente' ? {
        chave: process.env.PIX_KEY || 'sua-chave-pix-aqui',
        tipo: process.env.PIX_KEY_TYPE || 'aleatoria',
        recebedor: process.env.PIX_RECEIVER_NAME || 'Bela Vista Roleplay'
      } : null
    }
  });
});

module.exports = router;
