document.addEventListener('DOMContentLoaded', () => {
    // Helper: Remove brackets and quotes from list-like strings.
    function cleanListValue(val) {
        if (typeof val === 'string' && val.trim().startsWith('[') && val.trim().endsWith(']')) {
            return val.trim().slice(1, -1).replace(/['"]/g, '');
        }
        return val;
    }

    // Initialize Select2 on all multi-select dropdowns (for subfilters).
    $("#incidentTypeSelect, #sectorAffectedSelect, #launchTypeSelect, #typeOfSVSelect, #victimSexSelect, #ageGroupSelect").select2();

    // Force default selections for subfilter dropdowns.
    ["incidentTypeSelect", "sectorAffectedSelect", "launchTypeSelect", "typeOfSVSelect", "victimSexSelect", "ageGroupSelect"].forEach(id => {
        const $el = $("#" + id);
        const allValues = $el.find("option").map((i, el) => el.value).get();
        $el.val(allValues).trigger("change");
    });

    // Get dataset checkbox elements.
    const chkAidWorkers = document.getElementById('chkAidWorkers');
    const chkWeapons    = document.getElementById('chkWeapons');
    const chkCrsv       = document.getElementById('chkCrsv');

    // Get date inputs.
    const startDateInput = document.getElementById('startDate');
    const endDateInput   = document.getElementById('endDate');

    // Declare variables for Leaflet map and marker cluster.
    let map, markersLayer, markerRadius = 6;

    // Load CSV data.
    d3.csv("data/merged_dashboard_data.csv")
        .then(rawData => {
            // Process CSV data.
            const data = rawData.map(d => {
                const dateStr = d.Date.split("T")[0];
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
                    AdultOrMinor: d["Adult or Minor"],
                    dataset: dsArr
                };
            });

            // Set default date range based on data.
            const dates = data.map(d => d.Date);
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            startDateInput.valueAsDate = minDate;
            endDateInput.valueAsDate = maxDate;

            // Initialize Leaflet map.
            map = L.map('map', { maxZoom: 7 }).setView([20, 0], 2);
            const mapboxAccessToken = "";

            L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/512/{z}/{x}/{y}?access_token=${mapboxAccessToken}`, {
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, Imagery © Mapbox',
                maxZoom: 12
            }).addTo(map);

            markersLayer = L.markerClusterGroup({ disableClusteringAtZoom: 8 });
            map.addLayer(markersLayer);

            // Create a tooltip element for markers and bars.
            let tooltip = d3.select("body").select(".tooltip");
            if (tooltip.empty()) {
                tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);
            }

            // Helper: Return an array of selected dataset keys.
            function getSelectedDatasets() {
                const selected = [];
                if (chkAidWorkers.checked) selected.push("aid_workers");
                if (chkWeapons.checked)    selected.push("weapons");
                if (chkCrsv.checked)       selected.push("crsv");
                return selected;
            }

            // Main update function.
            function updateDashboard() {
                const selectedDatasets = getSelectedDatasets();
                const startDate = startDateInput.valueAsDate;
                const endDate = endDateInput.valueAsDate;

                // Filter data by date.
                const prelimFiltered = data.filter(d => d.Date >= startDate && d.Date <= endDate);

                // Further filter data based on dataset-specific subfilters.
                const globalFiltered = prelimFiltered.filter(d => {
                    let include = false;

                    // Aid Workers filtering.
                    if (d.dataset.includes("aid_workers") && selectedDatasets.includes("aid_workers")) {
                        const selTypes = $("#incidentTypeSelect").val().map(v => v.toLowerCase());
                        const passKilled = selTypes.includes("killed") && d.AidWorkersKilled > 0;
                        const passInjured = selTypes.includes("injured") && d.AidWorkersInjured > 0;
                        const passKidnapped = selTypes.includes("kidnapped") && d.AidWorkersKidnapped > 0;
                        const passArrested = selTypes.includes("arrested") && d.AidWorkersArrested > 0;
                        if (selTypes.length === 4 || passKilled || passInjured || passKidnapped || passArrested) {
                            include = true;
                        }
                    }

                    // Explosive Weapons filtering.
                    if (d.dataset.includes("weapons") && selectedDatasets.includes("weapons")) {
                        const selSectors = $("#sectorAffectedSelect").val().map(v => v.toLowerCase());
                        const selLaunches = $("#launchTypeSelect").val().map(v => v.toLowerCase());
                        let sectorOk = true;
                        let launchOk = true;
                        if (selSectors.length < $("#sectorAffectedSelect option").length) {
                            const rowSectors = d.SectorAffected ? cleanListValue(d.SectorAffected).split(',').map(s => s.trim().toLowerCase()) : [];
                            sectorOk = rowSectors.some(s => selSectors.includes(s));
                        }
                        if (selLaunches.length < $("#launchTypeSelect option").length) {
                            const rowLaunches = d.LaunchType ? cleanListValue(d.LaunchType).split(',').map(s => s.trim().toLowerCase()) : [];
                            launchOk = rowLaunches.some(l => selLaunches.includes(l));
                        }
                        if (sectorOk && launchOk) {
                            include = true;
                        }
                    }

                    // CRSV filtering.
                    if (d.dataset.includes("crsv") && selectedDatasets.includes("crsv")) {
                        const selTypes = $("#typeOfSVSelect").val().map(v => v.toLowerCase());
                        const selSexes = $("#victimSexSelect").val().map(v => v.toLowerCase());
                        const selAges = $("#ageGroupSelect").val().map(v => v.toLowerCase());
                        let typeOk = true, sexOk = true, ageOk = true;
                        if (selTypes.length < $("#typeOfSVSelect option").length) {
                            const rowTypes = d.TypeOfSV ? d.TypeOfSV.split(',').map(s => s.trim().toLowerCase()) : [];
                            typeOk = rowTypes.some(t => selTypes.includes(t));
                        }
                        if (selSexes.length < $("#victimSexSelect option").length) {
                            const rowSexes = d.SurvivorOrVictimSex ? d.SurvivorOrVictimSex.split(',').map(s => s.trim().toLowerCase()) : [];
                            sexOk = rowSexes.some(s => selSexes.includes(s));
                        }
                        if (selAges.length < $("#ageGroupSelect option").length) {
                            const rowAges = d.AdultOrMinor ? d.AdultOrMinor.split(',').map(s => s.trim().toLowerCase()) : [];
                            ageOk = rowAges.some(a => selAges.includes(a));
                        }
                        if (typeOk && sexOk && ageOk) {
                            include = true;
                        }
                    }
                    return include;
                });

                console.log("Filtered count:", globalFiltered.length);

                // Update map markers.
                markersLayer.clearLayers();
                globalFiltered.forEach(d => {
                    const marker = L.circleMarker([d.Latitude, d.Longitude], {
                        radius: markerRadius,
                        fillColor: "#F95454",
                        color: "#B82132",
                        fillOpacity: 0.6,
                        weight: 1
                    });
                    let tooltipContent = `<strong>${d.Country}</strong><br>${d.EventDescription}<br><em>Event ID: ${d.SiNDEventID}</em>`;
                    if (d.dataset.includes("aid_workers")) {
                        tooltipContent += `<br><small>Killed: ${d.AidWorkersKilled}, Injured: ${d.AidWorkersInjured}, Kidnapped: ${d.AidWorkersKidnapped}, Arrested: ${d.AidWorkersArrested}</small>`;
                    }
                    if (d.dataset.includes("weapons")) {
                        tooltipContent += `<br><small>Sector: ${cleanListValue(d.SectorAffected)}, Launch: ${cleanListValue(d.LaunchType)}</small>`;
                    }
                    if (d.dataset.includes("crsv")) {
                        tooltipContent += `<br><small>Type of SV: ${d.TypeOfSV}, Sex: ${d.SurvivorOrVictimSex}, Age: ${d.AdultOrMinor}</small>`;
                    }
                    marker.bindPopup(tooltipContent);
                    markersLayer.addLayer(marker);
                });

                // Determine time grouping for the bar chart.
                const totalDays = (endDate - startDate) / (1000 * 3600 * 24);
                let timeInterval, tickFormat;
                if (totalDays > 90) {
                    timeInterval = d3.timeMonth;
                    tickFormat = d3.timeFormat("%b %y");
                } else if (totalDays > 30) {
                    timeInterval = d3.timeWeek;
                    tickFormat = d3.timeFormat("%b %d");
                } else {
                    timeInterval = d3.timeDay;
                    tickFormat = d3.timeFormat("%b %d");
                }

                // Build counts per time bucket for selected datasets.
                const availableKeys = ["aid_workers", "weapons", "crsv"];
                const chartKeys = availableKeys.filter(k => selectedDatasets.includes(k));
                let countsByBucket = {};
                function addCount(date, category) {
                    const bucket = timeInterval(date);
                    const key = bucket.toISOString().split('T')[0];
                    if (!countsByBucket[key]) {
                        countsByBucket[key] = { date: bucket };
                        chartKeys.forEach(k => countsByBucket[key][k] = 0);
                    }
                    countsByBucket[key][category] += 1;
                }
                // For each dataset, aggregate counts.
                const aidFiltered = globalFiltered.filter(d => d.dataset.includes("aid_workers"));
                const weaponsFiltered = globalFiltered.filter(d => d.dataset.includes("weapons"));
                const crsvFiltered = globalFiltered.filter(d => d.dataset.includes("crsv"));
                if (chartKeys.includes("aid_workers")) {
                    aidFiltered.forEach(d => addCount(d.Date, "aid_workers"));
                }
                if (chartKeys.includes("weapons")) {
                    weaponsFiltered.forEach(d => addCount(d.Date, "weapons"));
                }
                if (chartKeys.includes("crsv")) {
                    crsvFiltered.forEach(d => addCount(d.Date, "crsv"));
                }
                const stackedData = Object.values(countsByBucket).sort((a, b) => a.date - b.date);

                // Update header summary.
                const totalFiltered = globalFiltered.length;
                const totalAll = prelimFiltered.length;
                document.getElementById("barChartHeader").innerHTML =
                    `<span class="header-number">${totalFiltered}</span> of <span class="header-total">${totalAll}</span> total incidents<br>` +
                    `happened between <span class="header-date">${startDate.toLocaleDateString()}</span> and <span class="header-date">${endDate.toLocaleDateString()}</span>`;

                // Build/update the stacked bar chart.
                updateBarChart(stackedData, tickFormat, chartKeys);
            }

            // Build/Update the Stacked Bar Chart.
            function updateBarChart(dataStacked, tickFormat, chartKeys) {
                d3.select("#chartContainer").select("svg").remove();
                const margin = { top: 10, right: 10, bottom: 40, left: 30 };
                const containerWidth = document.getElementById('chartContainer').clientWidth;
                const width = containerWidth - margin.left - margin.right - 40; // extra padding
                const height = 200 - margin.top - margin.bottom;
                const svg = d3.select("#chartContainer")
                    .append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
                    .attr("transform", `translate(${margin.left},${margin.top})`);

                const stack = d3.stack().keys(chartKeys);
                const series = stack(dataStacked);
                const x = d3.scaleBand()
                    .domain(dataStacked.map(d => d.date))
                    .range([0, width])
                    .padding(0.1);
                const y = d3.scaleLinear()
                    .domain([0, d3.max(dataStacked, d => chartKeys.reduce((sum, k) => sum + d[k], 0)) || 0])
                    .nice()
                    .range([height, 0]);
                const datasetNames = {
                    "aid_workers": "Aid Workers (KIKA)",
                    "weapons": "Explosive Weapons",
                    "crsv": "CRSV"
                };
                const color = d3.scaleOrdinal()
                    .domain(chartKeys)
                    .range(chartKeys.map(k => {
                        if (k === "aid_workers") return "#66c2a5";
                        if (k === "weapons") return "#fc8d62";
                        if (k === "crsv") return "#8da0cb";
                    }));
                const allTicks = x.domain();
                const tickStep = Math.ceil(allTicks.length / 8);
                const tickValues = allTicks.filter((d, i) => i % tickStep === 0);

                svg.selectAll("g.layer")
                    .data(series)
                    .enter()
                    .append("g")
                    .attr("class", "layer")
                    .attr("fill", d => color(d.key))
                    .selectAll("rect")
                    .data(d => d)
                    .enter()
                    .append("rect")
                    .attr("x", d => x(d.data.date))
                    .attr("y", d => y(d[1]))
                    .attr("height", d => y(d[0]) - y(d[1]))
                    .attr("width", x.bandwidth())
                    .on("mouseover", function(event, d) {
                        const datasetKey = d3.select(this.parentNode).datum().key;
                        const count = d.data[datasetKey];
                        tooltip.transition().duration(200).style("opacity", 0.9);
                        tooltip.html(`
              Date: ${d.data.date.toLocaleDateString()}<br>
              Dataset: ${datasetNames[datasetKey]}<br>
              Incidents: ${count}<br>
              Total: ${chartKeys.reduce((sum, k) => sum + d.data[k], 0)}
            `)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", function() {
                        tooltip.transition().duration(500).style("opacity", 0);
                    });

                svg.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(d3.axisBottom(x).tickFormat(tickFormat).tickValues(tickValues))
                    .selectAll("text")
                    .attr("transform", "rotate(-45)")
                    .style("text-anchor", "end")
                    .attr("fill", "grey");

                svg.append("g")
                    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d))
                    .selectAll("text")
                    .attr("fill", "grey");
            }

            // Add event listeners.
            startDateInput.addEventListener("change", updateDashboard);
            endDateInput.addEventListener("change", updateDashboard);
            $("#incidentTypeSelect, #sectorAffectedSelect, #launchTypeSelect, #typeOfSVSelect, #victimSexSelect, #ageGroupSelect")
                .on("change", updateDashboard);
            [chkAidWorkers, chkWeapons, chkCrsv].forEach(chk => {
                chk.addEventListener('change', updateDashboard);
            });

            // Initial update.
            updateDashboard();
        })
        .catch(error => {
            console.error("Error loading or processing data:", error);
        });
});
