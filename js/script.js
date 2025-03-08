
const CORS_PROXY = "https://api.allorigins.win/get?url=";


// Attempt to fetch API data with a CORS proxy

d3.json(CORS_PROXY + encodeURIComponent("https://sind-api.herokuapp.com/hdx/v1/aidWorkerKIKA"))
    .then(response => JSON.parse(response.contents))  // allorigins wraps data inside 'contents'
    .then(data => console.log(data))
    .catch(error => console.error("Error loading API data:", error));

document.addEventListener('DOMContentLoaded', () => {
    // Load the CSV data
    d3.csv("https://raw.githubusercontent.com/jennnoh/insecurity-dashboard/main/data/aidWorkerKIKA.csv", d => {
        return {
            Date: new Date(d.Date),
            EventDescription: d["Event Description"],
            Country: d.Country,
            Latitude: +d.Latitude,
            Longitude: +d.Longitude,
            AidWorkersKilled: +d["Aid Workers Killed"],
            AidWorkersInjured: +d["Aid Workers Injured"],
            AidWorkersKidnapped: +d["Aid Workers Kidnapped"],
            AidWorkersArrested: +d["Aid Workers Arrested"],
            AidWorkersKilledInCaptivity: +d["Aid Workers Killed in Captivity"],
            SiNDEventID: d["SiND Event ID"]
        };
    }).then(data => {
        // Compute total attacks for each record
        data.forEach(d => {
            d.totalAttacks = d.AidWorkersKilled +
                d.AidWorkersInjured +
                d.AidWorkersKidnapped +
                d.AidWorkersArrested +
                d.AidWorkersKilledInCaptivity;
        });

        // --- Set Up Filters ---
        const attackTypeSelect = document.getElementById("attackTypeSelect");
        const startDateInput = document.getElementById("startDate");
        const endDateInput = document.getElementById("endDate");

        // Determine overall date range from data
        const dates = data.map(d => d.Date);
        const minDate = new Date(Math.min.apply(null, dates));
        const maxDate = new Date(Math.max.apply(null, dates));
        startDateInput.valueAsDate = minDate;
        endDateInput.valueAsDate = maxDate;

        // --- Initialize the Leaflet Map ---
        const map = L.map('map', { maxZoom: 7 }).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 12,
        }).addTo(map);

        let markersLayer = L.markerClusterGroup({ disableClusteringAtZoom: 8 });
        map.addLayer(markersLayer);

        function updateDashboard() {
            let filteredData = data.filter(d => {
                return d.Date >= startDateInput.valueAsDate && d.Date <= endDateInput.valueAsDate;
            });

            const selectedAttack = attackTypeSelect.value;
            if (selectedAttack !== "all") {
                switch (selectedAttack) {
                    case "killed":
                        filteredData = filteredData.filter(d => d.AidWorkersKilled > 0);
                        break;
                    case "injured":
                        filteredData = filteredData.filter(d => d.AidWorkersInjured > 0);
                        break;
                    case "kidnapped":
                        filteredData = filteredData.filter(d => d.AidWorkersKidnapped > 0);
                        break;
                    case "arrested":
                        filteredData = filteredData.filter(d => d.AidWorkersArrested > 0);
                        break;
                    case "captivity":
                        filteredData = filteredData.filter(d => d.AidWorkersKilledInCaptivity > 0);
                        break;
                }
            }

            markersLayer.clearLayers();
            filteredData.forEach(d => {
                const radiusScale = d3.scaleSqrt()
                    .domain([0, d3.max(data, d => d.totalAttacks)])
                    .range([0, 20]);

                let baseRadius = radiusScale(d.totalAttacks);
                const marker = L.circleMarker([d.Latitude, d.Longitude], {
                    radius: baseRadius,
                    fillColor: "#F95454",
                    color: "#B82132",
                    fillOpacity: 0.6,
                    weight: 0,
                    baseRadius: baseRadius
                });
                marker.bindPopup(`
                    <strong>${d.Country}</strong><br>
                    ${d.EventDescription}<br>
                    <em>Event ID: ${d.SiNDEventID}</em><br>
                    <small>
                        Killed: ${d.AidWorkersKilled}, Injured: ${d.AidWorkersInjured},
                        Kidnapped: ${d.AidWorkersKidnapped}, Arrested: ${d.AidWorkersArrested},
                        Killed in Captivity: ${d.AidWorkersKilledInCaptivity}
                    </small>
                `);
                markersLayer.addLayer(marker);
            });
        }

        attackTypeSelect.addEventListener('change', updateDashboard);
        startDateInput.addEventListener('change', updateDashboard);
        endDateInput.addEventListener('change', updateDashboard);

        updateDashboard();
    }).catch(error => {
        console.error("Error loading or processing data:", error);
    });
});
