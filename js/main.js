// main.js – entry point.
import { initFilters, addFilterListeners, getFilterValues, filterData } from './filter.js';
import { initMap, updateMapMarkers } from './map.js';
import { updateBarChart } from './barChart.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize unified filter (Treeselect) and other multi-selects.
    initFilters();

    // Initialize the map.
    const { map, markersLayer, tooltip } = initMap();

    // Load CSV data from the "data" folder.
    d3.csv("data/merged_dashboard_data.csv").then(rawData => {
        // Process CSV data.
        // Convert date strings, parse numeric fields, and parse the dataset field.
        // Count incidents with missing lat/lon (censored by HDX)
        const removedIncidentsCount = rawData.filter(d => d.Latitude.trim() === "" || d.Longitude.trim() === "").length;

        // Filter out records without latitude or longitude values.
        const filteredRawData = rawData.filter(d => d.Latitude.trim() !== "" && d.Longitude.trim() !== "");

        const data = filteredRawData.map(d => {
            const dateStr = d.Date.split("T")[0];  // works for both "YYYY-MM-DD" and "YYYY-MM-DDT..."
            let dsArr = [];
            try {
                dsArr = JSON.parse(d.dataset.replace(/'/g, '"'));
            } catch (err) {
                dsArr = [];
            }
            return {
                Date: new Date(dateStr),
                Country: d.Country,
                EventDescription: d["Event Description"],
                SiNDEventID: d["SiND Event ID"],
                Latitude: +d.Latitude,
                Longitude: +d.Longitude,
                AidWorkersKilled: +d["Aid Workers Killed"],
                AidWorkersInjured: +d["Aid Workers Injured"],
                AidWorkersKidnapped: +d["Aid Workers Kidnapped"],
                AidWorkersArrested: +d["Aid Workers Arrested"],
                SectorAffected: d["Sector Affected"],
                LaunchType: d["Launch Type"],
                ExplosiveWeaponType: d["Explosive Weapon Type"],
                TypeOfSV: d["Type of SV"],
                SurvivorOrVictim: d["Survivor or Victim"],
                SurvivorOrVictimSex: d["Survivor Or Victim Sex"],
                AdultOrMinor: d["Adult or Minor "].trim(),  // note: there might be trailing space
                dataset: dsArr
            };
        });
        // Count CRSV records that are missing an EventDescription.
        const crsvMissingDescriptionCount = data.filter(d =>
            d.dataset.includes("crsv") &&
            (!d.EventDescription || d.EventDescription.trim() === "")
        ).length;

        // Update the note container with your custom messages.
        const notesContainer = document.getElementById("data-notes");
        notesContainer.innerHTML = `
        <p>* ${removedIncidentsCount} incidents were excluded as censored by HDX.</p>
        <p>** CRSV dataset records do not include an Event Description.</p>
    `;

        // Set default date range based on CSV data.
        const dates = data.map(d => d.Date);
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        document.getElementById("startDate").valueAsDate = minDate;
        document.getElementById("endDate").valueAsDate = maxDate;

        // Dashboard update function.
        // In main.js (simplified)
        function updateDashboard() {
            const filterValues = getFilterValues();
            const prelimFiltered = data.filter(d => d.Date >= filterValues.startDate && d.Date <= filterValues.endDate);
            const filteredData = filterData(data, filterValues);
            updateMapMarkers(markersLayer, filteredData, tooltip);
            updateBarChart(filteredData, prelimFiltered, data.length, filterValues);
        }


        addFilterListeners(updateDashboard);
        updateDashboard();
    })
        .catch(error => {
            console.error("Error loading or processing CSV data:", error);
        });
});
