const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  publicKey: { type: String, required: true, unique: true },
  nonce: { type: String },
  // timestamp (ISO) when nonce / SIWS message was issued
  nonceIssuedAt: { type: Date },
  lastLogin: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
