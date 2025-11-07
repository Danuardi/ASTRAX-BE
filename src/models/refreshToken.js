const mongoose = require('mongoose');

const refreshSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  publicKey: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('RefreshToken', refreshSchema);
