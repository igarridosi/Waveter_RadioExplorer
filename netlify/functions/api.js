const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: 'https://waveter.netlify.app/',}));

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
    // En lugar de stream, redirigir al cliente directamente a radio.garden
    res.redirect(`https://radio.garden/api/ara/content/listen/${radioId}/channel.mp3`);
  } catch (error) {
    res.status(500).send('Error fetching radio stream');
  }
});

module.exports.handler = serverless(app);