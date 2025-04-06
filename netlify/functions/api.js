const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');

const app = express();
const router = express.Router();

app.use(cors());

// Modificar las rutas para usar el router
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
    const response = await axios.get(`https://radio.garden/api/ara/content/listen/${radioId}/channel.mp3`, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Configurar headers CORS específicos para audio
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching radio stream' });
  }
});

app.use('/.netlify/functions/api', router);

module.exports.handler = serverless(app);