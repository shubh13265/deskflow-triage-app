const serverless = require('serverless-http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ticketsRouter = require('../../backend/routes/tickets');

const app = express();

app.use(cors());
app.use(express.json());

// Mount the tickets router
app.use('/.netlify/functions/api/tickets', ticketsRouter);
app.use('/api/tickets', ticketsRouter);

// Health check
app.get('/.netlify/functions/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

let cachedDb = null;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/deskflow';

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  // Avoid shutting down connection immediately
  context.callbackWaitsForEmptyEventLoop = false;

  if (!cachedDb) {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    cachedDb = mongoose.connection;
    console.log('Connected to MongoDB.');
  }

  return handler(event, context);
};