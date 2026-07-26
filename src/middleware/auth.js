function adminAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const adminToken = process.env.TOKEN_ADMIN;

  if (!adminToken || adminToken === 'SEU_TOKEN_ADMIN_AQUI') {
    return res.status(500).json({ error: 'TOKEN_ADMIN nao configurado no servidor' });
  }

  if (token !== adminToken) {
    return res.status(401).json({ error: 'Token invalido' });
  }

  next();
}

module.exports = { adminAuth };
