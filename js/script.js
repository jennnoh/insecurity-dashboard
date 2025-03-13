
document.addEventListener('DOMContentLoaded', () => {
    // Helper: Remove brackets and quotes from list-like strings
    function cleanListValue(val) {
        if (typeof val === 'string' && val.trim().startsWith('[') && val.trim().endsWith(']')) {
            return val.trim().slice(1, -1).replace(/['"]/g, '');
        }
        return val;
    }

    // Initialize Select2 on all multi-select dropdowns
    $("#datasetSelect, #incidentTypeSelect, #sectorAffectedSelect, #launchTypeSelect, #typeOfSVSelect, #victimSexSelect, #ageGroupSelect").select2();


    // Force default selections for categorical filters (all options selected)
    ["incidentTypeSelect", "sectorAffectedSelect", "launchTypeSelect", "typeOfSVSelect", "victimSexSelect", "ageGroupSelect"].forEach(id => {
        const $el = $("#" + id);
        const allValues = $el.find("option").map((i, el) => el.value).get();
        $el.val(allValues).trigger("change");
    });

    // Load data from CSV
    d3.csv("data/merged_dashboard_data.csv")
        .then(rawData => {
            // Process CSV data – using CSV's dataset as-is.
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

            // UI Elements
            const datasetSelect = document.getElementById("datasetSelect");
            const startDateInput = document.getElementById("startDate");
            const endDateInput = document.getElementById("endDate");
            const aidWorkersFilter = document.getElementById("aidWorkersFilter");
            const weaponsFilter = document.getElementById("weaponsFilter");
            const crsvFilter = document.getElementById("crsvFilter");
            const incidentTypeSelect = document.getElementById("incidentTypeSelect");
            const sectorAffectedSelect = document.getElementById("sectorAffectedSelect");
            const launchTypeSelect = document.getElementById("launchTypeSelect");
            const typeOfSVSelect = document.getElementById("typeOfSVSelect");
            const victimSexSelect = document.getElementById("victimSexSelect");
            const ageGroupSelect = document.getElementById("ageGroupSelect");

            // Set default date range based on data
            const dates = data.map(d => d.Date);
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            startDateInput.valueAsDate = minDate;
            endDateInput.valueAsDate = maxDate;

            // Initialize Leaflet Map
            const map = L.map('map', { maxZoom: 7 }).setView([20, 0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 12,
            }).addTo(map);
            let markersLayer = L.markerClusterGroup({ disableClusteringAtZoom: 8 });
            map.addLayer(markersLayer);
            const markerRadius = 6;

            // Tooltip for map and bar chart
            let tooltip = d3.select("body").select(".tooltip");
            if (tooltip.empty()) {
                tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);
            }

            // Update dynamic filter boxes (show/hide sub-filters based on dataset selection)
            function updateDynamicFilters() {
                const selectedDatasets = Array.from(datasetSelect.selectedOptions).map(opt => opt.value);
                aidWorkersFilter.style.display = selectedDatasets.includes("aid_workers") ? "block" : "none";
                weaponsFilter.style.display = selectedDatasets.includes("weapons") ? "block" : "none";
                crsvFilter.style.display = selectedDatasets.includes("crsv") ? "block" : "none";
            }
            updateDynamicFilters();

            $("#datasetSelect").on("change", () => {
                updateDynamicFilters();
                updateDashboard();

            });
            $("#incidentTypeSelect, #sectorAffectedSelect, #launchTypeSelect, #typeOfSVSelect, #victimSexSelect, #ageGroupSelect")
                .on("change", updateDashboard);
            startDateInput.addEventListener("change", updateDashboard);
            endDateInput.addEventListener("change", updateDashboard);

            // Main filtering: update numbers, map, and bar chart based on filters.
            function updateDashboard() {
                const selectedDatasets = Array.from(datasetSelect.selectedOptions).map(opt => opt.value);
                // Available keys: aid_workers, weapons, crsv.
                const availableKeys = ["aid_workers", "weapons", "crsv"];
                // Only use keys selected in dataset filter:
                const chartKeys = availableKeys.filter(k => selectedDatasets.includes(k));

                const startDate = startDateInput.valueAsDate;
                const endDate = endDateInput.valueAsDate;

                // Basic date filtering
                const prelimFiltered = data.filter(d => d.Date >= startDate && d.Date <= endDate);

                // Now apply category-specific filters:
                const globalFiltered = prelimFiltered.filter(d => {
                    let include = false;

                    // Aid Workers filtering
                    if (d.dataset.includes("aid_workers") && chartKeys.includes("aid_workers")) {
                        const selTypes = Array.from(incidentTypeSelect.selectedOptions).map(opt => opt.value.toLowerCase());
                        const allTypes = Array.from(incidentTypeSelect.options).map(opt => opt.value.toLowerCase());
                        if (selTypes.length === allTypes.length) {
                            include = include || true;
                        } else {
                            const passKilled = selTypes.includes("killed") && d.AidWorkersKilled > 0;
                            const passInjured = selTypes.includes("injured") && d.AidWorkersInjured > 0;
                            const passKidnapped = selTypes.includes("kidnapped") && d.AidWorkersKidnapped > 0;
                            const passArrested = selTypes.includes("arrested") && d.AidWorkersArrested > 0;
                            if (passKilled || passInjured || passKidnapped || passArrested) {
                                include = include || true;
                            }
                        }
                    }

                    // Weapons filtering
                    if (d.dataset.includes("weapons") && chartKeys.includes("weapons")) {
                        const selSectors = Array.from(sectorAffectedSelect.selectedOptions).map(opt => opt.value.toLowerCase());
                        const allSectors = Array.from(sectorAffectedSelect.options).map(opt => opt.value.toLowerCase());
                        const selLaunches = Array.from(launchTypeSelect.selectedOptions).map(opt => opt.value.toLowerCase());
                        const allLaunches = Array.from(launchTypeSelect.options).map(opt => opt.value.toLowerCase());

                        let sectorOk = true;
                        let launchOk = true;
                        if (selSectors.length !== allSectors.length) {
                            const sectors = d.SectorAffected ? cleanListValue(d.SectorAffected).split(',').map(s => s.trim().toLowerCase()) : [];
                            sectorOk = sectors.some(s => selSectors.includes(s));
                        }
                        if (selLaunches.length !== allLaunches.length) {
                            const launches = d.LaunchType ? cleanListValue(d.LaunchType).split(',').map(s => s.trim().toLowerCase()) : [];
                            launchOk = launches.some(l => selLaunches.includes(l));
                        }
                        if (sectorOk && launchOk) {
                            include = include || true;
                        }
                    }

                    // CRSV filtering
                    if (d.dataset.includes("crsv") && chartKeys.includes("crsv")) {
                        const selTypes = Array.from(typeOfSVSelect.selectedOptions).map(opt => opt.value.toLowerCase());
                        const allTypes = Array.from(typeOfSVSelect.options).map(opt => opt.value.toLowerCase());
                        const selSexes = Array.from(victimSexSelect.selectedOptions).map(opt => opt.value.toLowerCase());
                        const allSexes = Array.from(victimSexSelect.options).map(opt => opt.value.toLowerCase());
                        const selAges = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value.toLowerCase());
                        const allAges = Array.from(ageGroupSelect.options).map(opt => opt.value.toLowerCase());

                        let typeOk = true;
                        let sexOk = true;
                        let ageOk = true;
                        if (selTypes.length !== allTypes.length) {
                            const types = d.TypeOfSV ? d.TypeOfSV.split(',').map(s => s.trim().toLowerCase()) : [];
                            typeOk = types.some(t => selTypes.includes(t));
                        }
                        if (selSexes.length !== allSexes.length) {
                            const sexes = d.SurvivorOrVictimSex ? d.SurvivorOrVictimSex.split(',').map(s => s.trim().toLowerCase()) : [];
                            sexOk = sexes.some(s => selSexes.includes(s));
                        }
                        if (selAges.length !== allAges.length) {
                            const ages = d.AdultOrMinor ? d.AdultOrMinor.split(',').map(s => s.trim().toLowerCase()) : [];
                            ageOk = ages.some(a => selAges.includes(a));
                        }
                        if (typeOk && sexOk && ageOk) {
                            include = include || true;
                        }
                    }
                    return include;
                });

                console.log("globalFiltered:", globalFiltered.length);

                // Determine time grouping for bar chart
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

                // Build counts per time bucket (only for selected chart keys)
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


                // Build separate arrays for each category using globalFiltered
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

                // Update Map markers
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
                        tooltipContent += `<br><small>Type of SV: ${d.TypeOfSV}, Victim Sex: ${d.SurvivorOrVictimSex}, Age: ${d.AdultOrMinor}</small>`;
                    }
                    marker.bindPopup(tooltipContent);
                    markersLayer.addLayer(marker);
                });

                // Update header numbers
                const totalFiltered = globalFiltered.length;
                const totalAll = data.filter(d => d.Date >= startDate && d.Date <= endDate).length;
                document.getElementById("barChartHeader").innerHTML =
                    `<span class="header-number">${totalFiltered}</span> of <span class="header-total">${totalAll}</span> total incidents<br>happened between <span class="header-date">${startDate.toLocaleDateString()}</span> and <span class="header-date">${endDate.toLocaleDateString()}</span>`;

                updateBarChart(stackedData, tickFormat, chartKeys);
            }

            // Update Bar Chart using only selected dataset keys (chartKeys)
            function updateBarChart(dataStacked, tickFormat, chartKeys) {
                d3.select("#chartContainer").select("svg").remove();
                const margin = { top: 10, right: 10, bottom: 40, left: 30 };
                // Make chart full-width with padding:
                const containerWidth = document.getElementById('chartContainer').clientWidth;
                const width = containerWidth - margin.left - margin.right - 40; // extra padding of 40px total
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
                  Incidents in this dataset: ${count}<br>
                  Total (All Datasets): ${chartKeys.reduce((sum, k) => sum + d.data[k], 0)}
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

            updateDashboard();
        })
        .catch(error => {
            console.error("Error loading or processing data:", error);
        });
});
