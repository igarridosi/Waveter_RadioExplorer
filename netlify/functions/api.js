const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors());

app.get('/.netlify/functions/api/places', async (req, res) => {
  try {
    const response = await axios.get('https://radio.garden/api/ara/content/places');
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching data');
  }
});

app.get('/.netlify/functions/api/radios/:cityId', async (req, res) => {
  const { cityId } = req.params;
  try {
    const response = await axios.get(`https://radio.garden/api/ara/content/page/${cityId}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching radios data');
  }
});

app.get('/.netlify/functions/api/radio/:radioId', async (req, res) => {
  const { radioId } = req.params;
  try {
    const response = await axios.get(`https://radio.garden/api/ara/content/listen/${radioId}/channel.mp3`, {
      responseType: 'stream'
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);
  } catch (error) {
    res.status(500).send('Error fetching radio stream');
  }
});

module.exports.handler = serverless(app);