const admin = require('firebase-admin');
const { response } = require('express');

admin.initializeApp();

const db = admin.firestore();

module.exports = { admin, db };