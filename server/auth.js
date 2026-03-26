const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'casa-mahana-jwt-secret-2026';
const JWT_EXPIRES = '7d';

function hashPassword(plain) { return bcrypt.hashSync(plain, 10); }
function verifyPassword(plain, hash) { return bcrypt.compareSync(plain, hash); }

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
    JWT_SECRET, { expiresIn: JWT_EXPIRES }
  );
}

function decodeToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === (process.env.API_KEY || 'mahana-pms-key-2026')) {
    req.user = { id: 0, email: 'api', rol: 'admin', nombre: 'API' };
    return next();
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token requerido' } });
  }
  const decoded = decodeToken(auth.slice(7));
  if (!decoded) {
    return res.status(401).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Token inválido o expirado' } });
  }
  req.user = decoded;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } });
    if (!roles.includes(req.user.rol)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Sin permisos' } });
    next();
  };
}

module.exports = { hashPassword, verifyPassword, generateToken, decodeToken, requireAuth, requireRole };
