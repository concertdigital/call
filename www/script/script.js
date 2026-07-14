
alert(window.location.pathname);

async function loadData() {
    try {
        const response = await fetch('/api/getroom');

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        console.log(data);

        return data;
    } catch (error) {
        console.error('Failed to load API data:', error);
    }
}

loadData();