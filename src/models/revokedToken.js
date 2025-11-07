const mongoose = require('mongoose');

const revokedSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('RevokedToken', revokedSchema);
