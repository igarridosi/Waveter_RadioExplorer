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
    const [savedRadios, setSavedRadios] = useState([]);
    const [currentRadio, setCurrentRadio] = useState(null);
    const [showSavedList, setShowSavedList] = useState(false);

    useEffect(() => {
        // Fetch countries and cities
        {/*Test Path Change /.netlify/functions -> http://localhost:3000*/}
        axios.get('/.netlify/functions/api/places')
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

    // Añadir useEffect para cargar emisoras guardadas
    useEffect(() => {
        const savedStations = localStorage.getItem('savedRadios');
        if (savedStations) {
            setSavedRadios(JSON.parse(savedStations));
        }
    }, []);

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
        const selectedCity = allCities.find(city => city.id === selectedCityId);
        {/*Test Path Change /.netlify/functions -> http://localhost:3000*/}
        axios.get(`/.netlify/functions/api/radios/${selectedCityId}`)
        .then(response => {
            if (response.status === 200) {
                const data = response.data;
                const radios = data.data.content.flatMap(item => 
                    item.items.map(radio => {
                        const url = radio.page.url;
                        const id = url.split('/').pop();
                        return { 
                            ...radio.page, 
                            id,
                            country: selectedCity.country,
                            cityId: selectedCityId,
                            cityName: selectedCity.title  // Añadimos el nombre de la ciudad
                        };
                    })
                );
                // Mantener las radios guardadas en la lista
                const savedRadiosForCity = savedRadios.filter(radio => radio.cityId === selectedCityId);
                const uniqueRadios = [...radios, ...savedRadiosForCity].filter((radio, index, self) =>
                    index === self.findIndex((r) => r.id === radio.id)
                );
                setRadios(uniqueRadios);
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
    }

    function updateInputsForRadio(radio) {
        // Update the country input first
        const countryInput = document.getElementById("countriesList");
        countryInput.value = radio.country;

        // Update cities list for the selected country
        const citiesFromCountry = allItems.filter(item => item.country === radio.country);
        setCities(citiesFromCountry);

        // Show city elements
        document.getElementById("citiesLabel").style.display = 'inline';
        document.getElementById("citiesList").style.display = 'inline';

        // Pequeña espera para asegurar que las ciudades se han actualizado
        setTimeout(() => {
            const cityInput = document.getElementById("citiesList");
            if (cityInput) {
                cityInput.value = radio.cityId;
            }

            // Show radio elements
            document.getElementById("radiosLabel").style.display = 'inline';
            document.getElementById("radiosList").style.display = 'inline';

            // Update radio input
            const radioInput = document.getElementById("radiosList");
            radioInput.value = radio.id;
        }, 100);
    }

    function handleRadioChange(event) {
        const selectedRadioId = event.target.value;
        const selectedRadio = allRadios.find(radio => radio.id === selectedRadioId);
        if (selectedRadio) {
            // Asegurarse de que los inputs estén visibles
            document.getElementById("citiesLabel").style.display = 'inline';
            document.getElementById("citiesList").style.display = 'inline';
            document.getElementById("radiosLabel").style.display = 'inline';
            document.getElementById("radiosList").style.display = 'inline';

            const radioUrl = `https://radio.garden/api/ara/content/listen/${selectedRadio.id}/channel.mp3`;
            setCurrentRadioUrl(radioUrl);
            setCurrentRadio(selectedRadio);
            setError('');
            updateInputsForRadio(selectedRadio);
        }
    }

    async function handleRandomRadio() {
        // 1. Seleccionar país aleatorio
        if (allCountry.length === 0) {
            setError('No hay países disponibles.');
            return;
        }
        const randomCountry = allCountry[Math.floor(Math.random() * allCountry.length)];
        
        // 2. Obtener ciudades del país y seleccionar una aleatoria
        const citiesFromCountry = allItems.filter(item => item.country === randomCountry);
        if (citiesFromCountry.length === 0) {
            setError('No hay ciudades disponibles para este país.');
            return;
        }
        const randomCity = citiesFromCountry[Math.floor(Math.random() * citiesFromCountry.length)];
        
        try {
            // 3. Obtener radios de la ciudad
            {/*Test Path Change /.netlify/functions -> http://localhost:3000*/}
            const response = await axios.get(`/.netlify/functions/api/radios/${randomCity.id}`);
            if (response.status === 200) {
                const radios = response.data.data.content.flatMap(item => 
                    item.items.map(radio => {
                        const url = radio.page.url;
                        const id = url.split('/').pop();
                        return { 
                            ...radio.page, 
                            id,
                            country: randomCountry,
                            cityId: randomCity.id 
                        };
                    })
                );
                
                // 4. Seleccionar radio aleatoria
                if (radios.length === 0) {
                    setError('No hay radios disponibles en esta ciudad.');
                    return;
                }
                const randomRadio = radios[Math.floor(Math.random() * radios.length)];
                
                // Actualizar estado de radio actual
                setCurrentRadio({
                    ...randomRadio,
                    country: randomCountry,
                    cityId: randomCity.id
                });
                
                // 5. Actualizar UI y reproducir
                setRadios(radios);
                setCurrentRadioUrl(`https://radio.garden/api/ara/content/listen/${randomRadio.id}/channel.mp3`);
                
                // Mostrar selecciones en los inputs
                const countryInput = document.getElementById("countriesList");
                countryInput.value = randomCountry;
                handleCountryChange({ target: { value: randomCountry } });
                
                setTimeout(() => {
                    const cityInput = document.getElementById("citiesList");
                    if (cityInput) {
                        cityInput.style.display = 'inline';
                        document.getElementById("citiesLabel").style.display = 'inline';
                        cityInput.value = randomCity.id;
                        handleCityChange({ target: { value: randomCity.id } });
                    }
                    
                    setTimeout(() => {
                        const radioInput = document.getElementById("radiosList");
                        if (radioInput) {
                            radioInput.style.display = 'inline';
                            document.getElementById("radiosLabel").style.display = 'inline';
                            radioInput.value = randomRadio.id;
                        }
                    }, 100);
                }, 100);
                
                setError('');
            }
        } catch (error) {
            console.error('Error fetching radios:', error);
            setError('Error al cargar las radios. Por favor, inténtalo de nuevo.');
        }
    }

    // Modificar la función saveCurrentRadio
    function saveCurrentRadio() {
        if (currentRadio && !savedRadios.some(radio => radio.id === currentRadio.id)) {
            const radioToSave = {
                ...currentRadio,
                url: currentRadioUrl,
                cityName: allCities.find(city => city.id === currentRadio.cityId)?.title
            };
            const updatedSavedRadios = [...savedRadios, radioToSave];
            setSavedRadios(updatedSavedRadios);
            localStorage.setItem('savedRadios', JSON.stringify(updatedSavedRadios));
        }
    }

    function playFromSaved(savedRadio) {
        setCurrentRadioUrl(savedRadio.url);
        setCurrentRadio(savedRadio);

        // Ocultar lista en móvil
        if (window.innerWidth < 1024) {
            setShowSavedList(false);
        }

        // Mostrar los inputs y actualizar sus valores
        document.getElementById("citiesLabel").style.display = 'inline';
        document.getElementById("citiesList").style.display = 'inline';
        document.getElementById("radiosLabel").style.display = 'inline';
        document.getElementById("radiosList").style.display = 'inline';

        // Obtener todas las radios de la ciudad
        axios.get(`http://localhost:3000/api/radios/${savedRadio.cityId}`)
        .then(response => {
            if (response.status === 200) {
                const data = response.data;
                const radios = data.data.content.flatMap(item => 
                    item.items.map(radio => {
                        const url = radio.page.url;
                        const id = url.split('/').pop();
                        return { 
                            ...radio.page, 
                            id,
                            country: savedRadio.country,
                            cityId: savedRadio.cityId,
                            cityName: savedRadio.cityName
                        };
                    })
                );
                setRadios(radios);
            }
        })
        .catch(error => {
            console.error('Error fetching radios:', error);
            // Si falla la carga, al menos mostramos la radio guardada
            setRadios([savedRadio]);
        });

        // Actualizar los inputs
        updateInputsForRadio(savedRadio);
    }

    // Modificar la función removeSavedRadio
    function removeSavedRadio(radioId) {
        const updatedSavedRadios = savedRadios.filter(radio => radio.id !== radioId);
        setSavedRadios(updatedSavedRadios);
        localStorage.setItem('savedRadios', JSON.stringify(updatedSavedRadios));
    }

    function handleAudioError() {
        setError('Failed to load the radio stream. Please try another station.');
        // Remove the radio that caused the error from the list
        setRadios(prevRadios => prevRadios.filter(radio => `/.netlify/functions/api/radio/${radio.id}` !== currentRadioUrl));
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
        <div className="w-full max-w-screen mx-auto px-4 md:px-6 lg:px-0 flex flex-col lg:flex-row lg:gap-8">
            {/* Panel principal */}
            <div className="flex-1 flex flex-col gap-4 py-4">
                {/* Botones Random y Show/Hide List */}
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => setShowSavedList(!showSavedList)}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 md:py-4 md:px-8 rounded-lg flex items-center transition-colors"
                    >
                        {showSavedList ? '❌ Hide List' : '📻 Saved Radios'}
                    </button>
                    <button 
                        onClick={handleRandomRadio} 
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 md:py-4 md:px-8 rounded-lg flex items-center transition-colors"
                        title="Select a random radio"
                    >
                        🎲 Random
                    </button>
                </div>

                {/* Selector de País */}
                <div className="p-2 rounded-lg shadow-lg w-full md:w-[40rem] lg:w-[50rem]">
                    <label htmlFor="countries" className="block text-lg md:text-xl font-semibold text-white">
                        Choose a Country
                    </label>
                    <select 
                        name="countries" 
                        id="countriesList" 
                        onChange={handleCountryChange} 
                        className="bg-gray-700 border border-gray-600 text-white text-base md:text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3 md:p-4 font-medium transition-colors"
                    >
                    </select>
                </div>

                {/* Selector de Ciudad */}
                <div className="p-2 rounded-lg shadow-lg w-full">
                    <label htmlFor="cities" id="citiesLabel" className="hidden text-lg md:text-xl font-semibold text-white">
                        Choose a City
                    </label>
                    <select 
                        name="cities" 
                        id="citiesList" 
                        className="hidden bg-gray-700 border border-gray-600 text-white text-base md:text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 w-full p-3 md:p-4 font-medium transition-colors" 
                        onClick={handleCityChange}
                    >
                        {allCities.map((city, index) => (
                            <option key={index} value={city.id}>{city.title}</option>
                        ))}
                    </select>
                </div>

                {/* Selector de Radio y Controles */}
                <div className="p-2 rounded-lg shadow-lg w-full ">
                    <div className="flex flex-col md:flex-row gap-4 justify-center items-start md:items-center md:justify-center">
                        <div className="w-full">
                            <label htmlFor="radios" id="radiosLabel" className="hidden text-lg md:text-xl font-semibold text-white">
                                Choose a Radio
                            </label>
                            <div className='flex flex-row justify-between'>
                                <select 
                                    name="radios" 
                                    id="radiosList" 
                                    onChange={handleRadioChange} 
                                    className="hidden bg-gray-700 border border-gray-600 text-white text-base md:text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 w-full p-3 md:pr-4 font-medium transition-colors"
                                >
                                    {allRadios.map((radio, index) => (
                                        <option key={index} value={radio.id}>{radio.title}</option>
                                    ))}
                                </select>
                                {currentRadio && (
                                    <button 
                                        onClick={saveCurrentRadio} 
                                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-3 rounded-lg flex items-center transition-colors ml-5"
                                        title="Save current radio"
                                        disabled={savedRadios.some(radio => radio.id === currentRadio?.id)}
                                    >
                                        Save
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <p className="text-gray-300 text-sm md:text-base italic mt-4">
                        Note: Some radios may not work due to dial-themed restrictions or technical limitations set by the station owners.
                    </p>
                </div>

                {/* Reproductor de Audio */}
                {currentRadioUrl && (
                    <div className="p-4 md:p-6 rounded-lg shadow-lg">
                        <audio 
                            key={currentRadioUrl} 
                            controls 
                            autoPlay 
                            onError={handleAudioError} 
                            onCanPlay={handleAudioCanPlay} 
                            className="w-full bg-gray-700 rounded-lg custom-audio"
                        >
                            <source src={currentRadioUrl} type="audio/mpeg" />
                        </audio>
                    </div>
                )}

                {/* Mensajes de Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 md:p-6 rounded-lg shadow-lg">
                        {error}
                    </div>
                )}

                {limitReached && (
                    <div className='w-full flex flex-col justify-end items-end'>
                    <p style={{ color: 'white', fontSize:'1rem', fontStyle:'italic', marginTop:'0.7rem' }}>*If you have any problems loading the radio channel, just refresh the page by clicking this button.</p>
                    <button onClick={handleReload} class="mt-3 text-red hover:before:bg-redborder-red-500 px-4 py-2 relative rounded-lg overflow-hidden bg-gray-700 text-white font-bold shadow-2xl transition-all before:absolute before:bottom-0 before:left-0 before:top-0 before:z-0 before:h-full before:w-0 before:bg-red-500 before:transition-all before:duration-300 hover:text-gray-700 hover:shadow-black hover:before:left-0 hover:before:w-full"><span class=" rounded relative z-10">Reload Page</span></button>
                    </div>
                )}
            </div>

            {/* Lista de Emisoras Guardadas */}
            <div className="w-full lg:w-96 mt-6 lg:mt-0 relative">
                {savedRadios.length > 0 && showSavedList && (
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 md:p-6 shadow-lg 
                        lg:sticky lg:top-4 
                        fixed bottom-0 left-0 right-0
                        w-full lg:w-[30vw] 
                        h-[50vh] lg:h-[55vh] 
                        z-50">
                        <h3 className="text-white text-xl md:text-2xl font-bold mb-4 
                            sticky top-0 backdrop-blur-sm p-2 rounded-t-lg">
                            Saved Radios
                        </h3>
                        <div className="space-y-3 overflow-y-auto h-[calc(100%-4rem)] pr-2">
                            {savedRadios.map(radio => (
                                <div 
                                    key={radio.id} 
                                    className="bg-gray-700 hover:bg-gray-600 p-4 md:p-6 rounded-lg transition-colors group"
                                >
                                    <div className="flex justify-between items-start">
                                        <button
                                            onClick={() => playFromSaved(radio)}
                                            className="text-left flex-1"
                                        >
                                            <p className="font-bold text-white group-hover:text-blue-400 transition-colors text-sm md:text-base">
                                                {radio.title}
                                            </p>
                                            <p className="text-xs md:text-sm text-gray-400 mt-2">
                                                {radio.country}
                                            </p>
                                        </button>
                                        <button
                                            onClick={() => removeSavedRadio(radio.id)}
                                            className="text-gray-400 hover:text-red-500 transition-colors ml-4"
                                            title="Remove from saved"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ExploreRadios;