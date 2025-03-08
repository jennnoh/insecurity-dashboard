// // Attempt to fetch API data with a CORS proxy
// d3.json(CORS_PROXY + encodeURIComponent("https://sind-api.herokuapp.com/hdx/v1/aidWorkerKIKA"))
//     .then(response => JSON.parse(response.contents))  // allorigins wraps data inside 'contents'
//     .then(data => console.log(data))
//     .catch(error => console.error("Error loading API data:", error));


document.addEventListener('DOMContentLoaded', () => {
    // Load the API
    const CORS_PROXY = "https://api.allorigins.win/get?url=";
    const API_URL = "https://sind-api.herokuapp.com/hdx/v1/aidWorkerKIKA";

    d3.json(CORS_PROXY + encodeURIComponent(API_URL))
        .then(response => JSON.parse(response.contents))
        .then(data => {
            // console.log(data);
            return data;
        })
        .then(data => data.map(d => {
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
    })).then(data => {
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
        // Limit maxZoom so users cannot zoom in too far
        const map = L.map('map', { maxZoom: 7 }).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 12,
        }).addTo(map);

        // Create a Marker Cluster Group for markers with clustering disabled at very high zoom
        let markersLayer = L.markerClusterGroup({disableClusteringAtZoom: 8});

        map.addLayer(markersLayer);

        // --- Add Zoom Listener to Dynamically Scale Marker Sizes ---
        const initialZoom = map.getZoom(); // capture initial zoom level
        map.on('zoomend', function() {
            let currentZoom = map.getZoom();
            let scaleFactor = currentZoom / initialZoom;

            markersLayer.eachLayer(marker => {
                marker.setRadius(marker.options.baseRadius * scaleFactor);

            });
        });

        // --- Create a Tooltip for the Bar Chart ---
        let tooltip = d3.select("body").select(".tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body")
                .append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);
        }

        // --- Update Dashboard Function ---
        function updateDashboard() {
            // Filter data based on date range
            let filteredData = data.filter(d => {
                return d.Date >= startDateInput.valueAsDate && d.Date <= endDateInput.valueAsDate;
            });

            // Filter further based on attack type (if not "all")
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

            // --- Update the Dynamic Bar Chart Header and Footer ---
            const totalAttacksFiltered = d3.sum(filteredData, d => d.totalAttacks);
            const totalAttacksAll = d3.sum(data, d => d.totalAttacks);
            const startDateStr = startDateInput.valueAsDate.toLocaleDateString();
            const endDateStr = endDateInput.valueAsDate.toLocaleDateString();

            document.getElementById("barChartHeader").innerHTML =

                `<span class="header-number">${totalAttacksFiltered}</span> of 
                 <span class="header-total">${totalAttacksAll}</span> total attacks<br>
                 between <span class="header-date">${startDateStr}</span> and 
                 <span class="header-date">${endDateStr}</span>`;

            // --- Update the Map ---
            markersLayer.clearLayers();
            filteredData.forEach(d => {
                // Determine marker base radius: if a single incident, use a larger fixed radius
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
                    baseRadius: baseRadius // store the base radius for later use
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

            // --- Update the Bar Chart ---
            updateBarChart(filteredData);
        }

        // --- Update Bar Chart Function (Aggregated by Month) ---
        function updateBarChart(filteredData) {
            // Group data by month using d3.timeMonth
            const groupedData = d3.rollups(
                filteredData,
                v => d3.sum(v, d => d.totalAttacks),
                d => d3.timeMonth(d.Date)
            ).map(([date, total]) => ({ date, total }));

            // Sort the grouped data by month
            groupedData.sort((a, b) => a.date - b.date);

            // Set dimensions for the bar chart (wider now)
            const margin = { top: 10, right: 10, bottom: 40, left: 30 };
            const width = 450 - margin.left - margin.right;
            const height = 200 - margin.top - margin.bottom;

            // Remove any existing SVG in the chart container
            d3.select("#chartContainer").select("svg").remove();

            // Create the SVG container for the bar chart inside #chartContainer
            const svg = d3.select("#chartContainer")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // Create a band scale for the x-axis using month dates
            const x = d3.scaleBand()
                .domain(groupedData.map(d => d.date))
                .range([0, width])
                .padding(0.1);

            // y-axis scale
            const y = d3.scaleLinear()
                .domain([0, d3.max(groupedData, d => d.total)])
                .nice()
                .range([height, 0]);

            // Add horizontal grid lines (based on y-axis ticks)
            svg.append("g")
                .attr("class", "grid")
                .call(d3.axisLeft(y)
                    .tickSize(-width)
                    .tickFormat("")
                );

            // Add y-axis with tick labels in grey (and remove the vertical line)
            const yAxis = svg.append("g")
                .call(d3.axisLeft(y)
                    .ticks(5)
                    .tickSize(0)
                    .tickFormat(d => d)
                );
            yAxis.select(".domain").remove();
            yAxis.selectAll("text").attr("fill", "grey").attr("dx", "-0.8em");

            // Add x-axis with tick labels every 4 months in format "Feb 22"
            const tickValues = groupedData.filter((d, i) => i % 4 === 0).map(d => d.date);
            svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x)
                    .tickValues(tickValues)
                    .tickFormat(d3.timeFormat("%b %y"))
                )
                .selectAll("text")
                .attr("transform", "rotate(-45)")
                .style("text-anchor", "end")
                .attr("fill", "grey");

            // Draw the bars and attach tooltip events (bars shifted slightly to the left)
            // Bind data to bars
            const bars = svg.selectAll(".bar")
                .data(groupedData);

// EXIT phase: Remove bars that are no longer needed
            bars.exit()
                .transition()
                .duration(750)
                .attr("y", y(0))
                .attr("height", 0)
                .remove();

// UPDATE phase: Transition existing bars to new positions/sizes
            bars.transition()
                .duration(750)
                .attr("x", d => x(d.date) - 5)
                .attr("y", d => y(d.total))
                .attr("width", x.bandwidth())
                .attr("height", d => height - y(d.total));

// ENTER phase: Append new bars for new data
            bars.enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.date) - 5)
                .attr("y", y(0)) // start from the bottom
                .attr("width", x.bandwidth())
                .attr("height", 0)
                .attr("fill", "#69b3a2")
                .on("mouseover", function(event, d) {
                    tooltip.transition().duration(200).style("opacity", 0.9);
                    tooltip.html(`Month: ${d3.timeFormat("%b %Y")(d.date)}<br/>Number of Attacks: ${d.total}`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    tooltip.transition().duration(500).style("opacity", 0);
                })
                .transition()
                .duration(750)
                .attr("y", d => y(d.total))
                .attr("height", d => height - y(d.total));

        }

        // --- Set Up Event Listeners for Filters ---
        attackTypeSelect.addEventListener('change', updateDashboard);
        startDateInput.addEventListener('change', updateDashboard);
        endDateInput.addEventListener('change', updateDashboard);

        // Initial dashboard update
        updateDashboard();

    }).catch(error => {
        console.error("Error loading or processing data:", error);
    });
});
