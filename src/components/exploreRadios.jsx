import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../App.css';

function ExploreRadios() {
    const [allItems, setAllItems] = useState([]);
    const [allCountry, setAllCountry] = useState([]);
    const [allCities, setCities] = useState([]);
    const [allRadios, setRadios] = useState([]);
    const [currentRadioUrl, setCurrentRadioUrl] = useState('');
    const [error, setError] = useState('');
    const [radioCount, setRadioCount] = useState(0);
    const [limitReached, setLimitReached] = useState(false);

    useEffect(() => {
        // Fetch countries and cities
        axios.get('/api/places')
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
        document.getElementById("citiesLabel").style.display = 'inline';
        document.getElementById("citiesList").style.display = 'inline';

        const selectedCountry = event.target.value;
        const citiesFromCountry = allItems
        .filter(item => item.country === selectedCountry)
        .map(item => item);
        citiesFromCountry.sort();
        setCities(citiesFromCountry);
    }

    function handleCityChange(event) {
        document.getElementById("radiosLabel").style.display = 'inline';
        document.getElementById("radiosList").style.display = 'inline';
        const selectedCityId = event.target.value;
        
        // Agregar manejo de errores más detallado
        axios.get(`/api/radios/${selectedCityId}`)
            .then(response => {
                if (response.status === 200 && response.data) {
                    const data = response.data;
                    const radios = data.data.content.flatMap(item => 
                        item.items.map(radio => {
                            const url = radio.page.url;
                            const id = url.split('/').pop();
                            return { ...radio.page, id };
                        })
                    );
                    const halfRadios = radios.slice(0, Math.ceil(radios.length / 2));
                    setRadios(halfRadios);
                } else {
                    console.error('Invalid response format:', response);
                    setError('Error loading radio stations');
                }
            })
            .catch(error => {
                console.error('Error fetching radio stations:', error);
                setError('Error loading radio stations');
            });
    }

    function handleRadioChange(event) {
        if (radioCount >= 5) {
            setLimitReached(true);
            return;
        }

        const selectedRadioId = event.target.value;
        // Obtener la URL del stream
        axios.get(`/api/radio/${selectedRadioId}`)
            .then(response => {
                if (response.data && response.data.streamUrl) {
                    setCurrentRadioUrl(response.data.streamUrl);
                    setError('');
                } else {
                    setError('Error loading radio stream');
                }
            })
            .catch(error => {
                console.error('Error fetching radio stream:', error);
                setError('Error loading radio stream');
            });
    }

    function handleAudioError() {
        setError('Failed to load the radio stream. Please try another station.');
        // Remove the radio that caused the error from the list
        setRadios(prevRadios => prevRadios.filter(radio => `http://localhost:3000/api/radio/${radio.id}` !== currentRadioUrl));
        setCurrentRadioUrl(''); // Clear the current radio URL
    }

    function handleAudioCanPlay() {
        setRadioCount(prevCount => prevCount + 1);
        if (radioCount + 1 >= 5) {
        setLimitReached(true);
        }
    }

    function handleReload() {
        window.location.reload();
    }

    return (
        <div className='max-w-2xl mx-auto'>
            <div>
                <label for="countries" className="block mt-2 mb-2 text-md font-medium text-gray-900 dark:text-gray-400">Choose a country</label>
                <select name="countries" id="countriesList" onChange={handleCountryChange} className='bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 font-bold dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'>
                </select>
            </div>
            <div className='mt-5'>
                <label for="cities" id='citiesLabel' className="hidden mt-2 mb-2 text-md font-medium text-gray-900 dark:text-gray-400">Choose a city</label>
                <select name="cities" id="citiesList" className='hidden bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white font-bold dark:focus:ring-blue-500 dark:focus:border-blue-500' onClick={handleCityChange}>
                    {allCities.map((city, index) => (
                    <option key={index} value={city.id} className='text-bold'>{city.title}</option>
                    ))}
                </select>
            </div>

            <div className='mt-5'>
                <label for="radios" id='radiosLabel' className="hidden mt-2 mb-2 text-md font-medium text-gray-900 dark:text-gray-400">Choose a Radio</label>
                {/*disabled={limitReached} */}
                <select name="radios" id="radiosList" onChange={handleRadioChange} className='hidden bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 w-full p-2.5 dark:bg-gray-700 font-bold dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'>
                {allRadios.map((radio, index) => (
                <option key={index} value={radio.id}>{radio.title}</option>
                ))}
                </select>
                <p style={{ color: 'white', fontSize:'0.8rem', fontStyle:'italic', marginTop:'0.7rem' }}>Note: Some radios may not work due to dial-themed restrictions or technical limitations set by the station owners.</p>
            </div>
            {currentRadioUrl && (
                <div className="mt-4 p-4 bg-white rounded-lg shadow-md dark:bg-gray-300">
                    <audio 
                        key={currentRadioUrl} 
                        controls 
                        autoPlay 
                        crossOrigin="anonymous"
                        onError={handleAudioError} 
                        onCanPlay={handleAudioCanPlay} 
                        className="w-full bg-[#4977da] rounded custom-audio"
                    >
                        <source src={currentRadioUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}
            {error && <p style={{ color: 'red', fontSize:'1rem', fontWeight:'bold' }}>{error}</p>}
            {limitReached && (
                <div>
                <p style={{ color: 'white', fontSize:'1rem', fontStyle:'italic', marginTop:'0.7rem' }}>*If you have any problems loading the radio channel, just refresh the page by clicking this button.</p>
                <button onClick={handleReload} class="mt-3 text-red hover:before:bg-redborder-red-500 px-4 py-2 relative rounded-lg overflow-hidden bg-gray-700 text-white font-bold shadow-2xl transition-all before:absolute before:bottom-0 before:left-0 before:top-0 before:z-0 before:h-full before:w-0 before:bg-red-500 before:transition-all before:duration-300 hover:text-gray-700 hover:shadow-black hover:before:left-0 hover:before:w-full"><span class=" rounded relative z-10">Reload Page</span></button>
                </div>
            )}
        </div>
    );
}

export default ExploreRadios;