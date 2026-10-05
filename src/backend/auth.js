// Authentication Service Placeholder
// Dependencies: bcrypt, jsonwebtoken

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

function generateToken(user) {
    return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

module.exports = { hashPassword, verifyPassword, generateToken };
