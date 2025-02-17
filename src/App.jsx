import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [allItems, setAllItems] = useState([]);
  const [allCountry, setAllCountry] = useState([]);
  const [allCities, setCities] = useState([]);
  const [allRadios, setRadios] = useState([]);
  const [currentRadioUrl, setCurrentRadioUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch countries and cities
    axios.get('http://localhost:3000/api/places')
    .then(response => {
      if (response.status === 200) {
        const data = response.data;

        const countries = data.data.list.map(item => item.country);
        const uniqueCountries = [...new Set(countries)];
        setAllCountry(uniqueCountries.sort());

        const items = data.data.list.map(item => item);
        setAllItems(items);
      } else {
        console.error(`Failed to retrieve data: ${response.status}`);
      }
    })
    .catch(error => {
      console.error('Error fetching data:', error);
    });
  }, []);

  useEffect(() => {
    printCountries();
  }, [allCountry]);

  function printCountries(){
    let countryContainer = document.getElementById("countriesList");
    countryContainer.innerHTML = ''; // Clear previous options

    allCountry.forEach(country => {
      countryContainer.innerHTML += 
      `
      <option value="${country}">${country}</option>
      `;
    });
  }

  function handleCountryChange(event) {
    document.getElementById("citiesList").style.display = 'inline';

    const selectedCountry = event.target.value;
    const citiesFromCountry = allItems
      .filter(item => item.country === selectedCountry)
      .map(item => item);
    citiesFromCountry.sort();
    setCities(citiesFromCountry);
  }

  function handleCityChange(event) {
    const selectedCityId = event.target.value;
    axios.get(`http://localhost:3000/api/radios/${selectedCityId}`)
      .then(response => {
        if (response.status === 200) {
          const data = response.data;
          const radios = data.data.content.flatMap(item => 
            item.items.map(radio => {
              const url = radio.page.url;
              const id = url.split('/').pop(); // Extract the ID from the URL
              return { ...radio.page, id }; // Return the radio object with the extracted ID
            })
          );
          setRadios(radios);
          console.log(radios);
        } else {
          console.error(`Failed to retrieve data: ${response.status}`);
        }
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  }

  function handleRadioChange(event) {
    const selectedRadioId = event.target.value;
    const radioUrl = `http://localhost:3000/api/radio/${selectedRadioId}`;
    setCurrentRadioUrl(radioUrl);
    setError(''); // Clear previous errors
  }

  function handleAudioError() {
    setError('Failed to load the radio stream. Please try another station.');
  }

  return (
    <div cz-shortcut-listen="true">
      <select name="countries" id="countriesList" onChange={handleCountryChange}>
      </select>
      <select name="cities" id="citiesList" className='hidden' onClick={handleCityChange}>
        {allCities.map((city, index) => (
          <option key={index} value={city.id}>{city.title}</option>
        ))}
      </select>
      <div>
        <select name="radios" id="radiosList" onChange={handleRadioChange}>
        {allRadios.map((radio, index) => (
          <option key={index} value={radio.id}>{radio.title}</option>
        ))}
        </select>
      </div>
      {currentRadioUrl && (
        <audio key={currentRadioUrl} controls autoPlay onError={handleAudioError}>
          <source src={currentRadioUrl} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default App;