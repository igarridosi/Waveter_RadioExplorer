import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const port = 3000;

// Use CORS middleware
app.use(cors({
origin: 'http://localhost:5173', // Replace with your React app's URL
}));

app.get('/api/places', async (req, res) => {
try {
    const response = await axios.get('https://radio.garden/api/ara/content/places');
    res.json(response.data);
} catch (error) {
    res.status(500).send('Error fetching data');
}
});

// New route to handle radios API
app.get('/api/radios/:cityId', async (req, res) => {
const { cityId } = req.params;
try {
    const response = await axios.get(`https://radio.garden/api/ara/content/page/${cityId}`);
    res.json(response.data);
} catch (error) {
    res.status(500).send('Error fetching radios data');
}
});

// New route to handle radio stream URL
app.get('/api/radio/:radioId', async (req, res) => {
const { radioId } = req.params;
try {
    const response = await axios.get(`https://radio.garden/api/ara/content/listen/${radioId}/channel.mp3`, {
    responseType: 'stream'
    });
    response.data.pipe(res);
} catch (error) {
    res.status(500).send('Error fetching radio stream');
}
});

app.listen(port, () => {
console.log(`Server running at http://localhost:${port}`);
});