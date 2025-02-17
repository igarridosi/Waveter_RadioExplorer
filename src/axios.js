import axios from 'axios';

// Function to fetch countries and cities
async function fetchCountriesAndCities() {
    try {
        const response = await axios.get('http://radio.garden/api/ara/content/places');
        const countries = response.data.list;

        // Assuming the response structure is an array of objects with country and city information
        console.log(countries);

        // Populate the dropdown with countries
        const countrySelect = document.getElementById('country-select');
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.id;
            option.textContent = country.name;
            countrySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching countries and cities:', error);
    }
}

fetchCountriesAndCities();