const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');

const app = express();
const router = express.Router();

app.use(cors());

router.get('/places', async (req, res) => {
  try {
    const response = await axios.get('https://radio.garden/api/ara/content/places');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching data' });
  }
});

router.get('/radios/:cityId', async (req, res) => {
  const { cityId } = req.params;
  try {
    const response = await axios.get(`https://radio.garden/api/ara/content/page/${cityId}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching radios data' });
  }
});

router.get('/radio/:radioId', async (req, res) => {
  const { radioId } = req.params;
  try {
    // En lugar de transmitir el audio, obtenemos la URL directa
    const response = await axios.get(`https://radio.garden/api/ara/content/listen/${radioId}/channel.mp3`);
    // Devolvemos la URL directa al cliente
    res.json({ streamUrl: `https://radio.garden/api/ara/content/listen/${radioId}/channel.mp3` });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching radio stream' });
  }
});

app.use('/', router);

module.exports.handler = serverless(app);