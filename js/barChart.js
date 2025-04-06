// barChart.js – builds/updates the line chart with overlaid total bars and header.
const aidWorkersLeaves = ["killed", "injured", "kidnapped", "arrested"];
const weaponsSectorLeaves = ["aid_operations", "health_care", "food_security", "education", "idp_refugee_protection"];
const weaponsLaunchLeaves = ["air_launched", "air_launched_plane", "air_launched_drone", "air_launched_helicopter", "ground_launched", "directly_emplaced", "unspecified_launch_method"];
const crsvLeaves = ["rape", "sexual_slavery", "forced_prostitution", "male", "female", "adult", "minor"];

function formatDateAsSelected(date) {
    // date.toISOString() always returns a string in the form "YYYY-MM-DDT00:00:00.000Z"
    const [year, month, day] = date.toISOString().split('T')[0].split('-');
    return `${month}/${day}/${year}`;
}

export function updateBarChart(filteredData, prelimFiltered, fullCount, filterValues) {
    // Update header using fullCount for overall total.
    document.getElementById("barChartHeader").innerHTML =
        `<span class="header-number">${filteredData.length}</span> of <span class="header-total">${fullCount}</span> total incidents<br>` +
        `happened between <span class="header-date">${formatDateAsSelected(filterValues.startDate)}</span> and <span class="header-date">${formatDateAsSelected(filterValues.endDate)}</span>`;

    // Determine time grouping.
    const totalDays = (filterValues.endDate - filterValues.startDate) / (1000 * 3600 * 24);
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

    let tooltipFormat;
    if (totalDays > 90) {
        // Aggregated by month.
        tooltipFormat = d3.timeFormat("%b %Y");
    } else if (totalDays > 30) {
        // Aggregated by week.
        tooltipFormat = d3.timeFormat("%b %d");
    } else {
        // Aggregated by day.
        tooltipFormat = d3.timeFormat("%b %d");
    }

    // Aggregate filtered data into time buckets.
    let countsByBucket = {};
    function addCount(date, key) {
        const bucket = timeInterval(date);
        const bKey = bucket.toISOString().split("T")[0];
        if (!countsByBucket[bKey]) {
            countsByBucket[bKey] = { date: bucket, aid_workers: 0, weapons: 0, crsv: 0 };
        }
        countsByBucket[bKey][key] += 1;
    }

    filteredData.forEach(d => {
        // Make sure filterValues is defined and has a "filters" array
        if (!filterValues || !Array.isArray(filterValues.filters)) return;

        // If "aid_workers" is in the record AND the user has selected any of the Aid Workers leaves
        if (
            d.dataset.includes("aid_workers") &&
            filterValues.filters.some(f => aidWorkersLeaves.includes(f))
        ) {
            addCount(d.Date, "aid_workers");
        }

        // If "weapons" is in the record AND the user has selected any of the Weapons leaves
        if (
            d.dataset.includes("weapons") &&
            filterValues.filters.some(f => weaponsSectorLeaves.includes(f) || weaponsLaunchLeaves.includes(f))
        ) {
            addCount(d.Date, "weapons");
        }

        // If "crsv" is in the record AND the user has selected any of the CRSV leaves
        if (
            d.dataset.includes("crsv") &&
            filterValues.filters.some(f => crsvLeaves.includes(f))
        ) {
            addCount(d.Date, "crsv");
        }
    });


    const aggregatedData = Object.values(countsByBucket).sort((a, b) => a.date - b.date);
    aggregatedData.forEach(d => {
        d.total = d.aid_workers + d.weapons + d.crsv;
    });

    // Remove previous chart.
    d3.select("#chartContainer").select("svg").remove();

    const margin = { top: 10, right: 10, bottom: 40, left: 30 };
    const containerWidth = document.getElementById("chartContainer").clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    // Append the SVG container.
    const svg = d3.select("#chartContainer")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    // Define scales before creating the grid.
    const x = d3.scaleTime()
        .domain(d3.extent(aggregatedData, d => d.date))
        .range([0, width]);

    const maxTotal = d3.max(aggregatedData, d => d.total);
    const y = d3.scaleLinear()
        .domain([0, maxTotal])
        .nice()
        .range([height, 0]);

    // Create grid group first (this will be rendered behind other elements).
    const gridGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const yAxisGrid = d3.axisLeft(y)
        .ticks(5)
        .tickSize(-width)
        .tickFormat(d => d);
    gridGroup.call(yAxisGrid);
    gridGroup.select(".domain").remove(); // Remove the vertical axis line.
    gridGroup.selectAll("line")
        .attr("fill-opacity", 0.5)
        .attr("stroke", "#ddd");
    gridGroup.selectAll("text")
        .attr("fill", "grey")
        .attr("dx", "-0.5em");

    // Create chart group for bars, lines, circles, and x-axis (rendered on top of grid).
    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Draw the bar chart for total incidents.
    const numBuckets = aggregatedData.length;
    const barWidth = width / numBuckets * 0.8; // 80% of bucket width
    chartGroup.selectAll(".bar")
        .data(aggregatedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.date) - barWidth / 2)
        .attr("y", d => y(d.total))
        .attr("width", barWidth)
        .attr("height", d => height - y(d.total))
        .attr("fill", "#d5d5d5")
        .attr("fill-opacity", 0.7)
        .on("mouseover", function(event, d) {
            d3.select("body").select(".tooltip")
                .html(`Date: <b>${tooltipFormat(d.date)}</b><br>Total Incidents: <b>${d.total}</b>`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px")
                .transition().duration(200).style("opacity", 0.9);
        })
        .on("mouseout", function() {
            d3.select("body").select(".tooltip")
                .transition().duration(500).style("opacity", 0);
        });

    // 2. Draw line charts and circles for each dataset only if there is data.
    const datasets = ["aid_workers", "weapons", "crsv"];
    const displayNames = {
        "aid_workers": "Aid Worker Incidents:",
        "weapons": "Explosive Weapons Incidents:",
        "crsv": "CRSV Incidents:"
    };
    const color = d3.scaleOrdinal()
        .domain(datasets)
        .range(["#66c2a5", "#fc8d62", "#8da0cb"]);

    datasets.forEach(key => {
        const maxValue = d3.max(aggregatedData, d => d[key]);
        if (maxValue > 0) {
            const lineGenerator = d3.line()
                .x(d => x(d.date))
                .y(d => y(d[key]))
                .curve(d3.curveMonotoneX);
            chartGroup.append("path")
                .datum(aggregatedData)
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);

            chartGroup.selectAll(`.circle-${key}`)
                .data(aggregatedData)
                .enter()
                .append("circle")
                .attr("class", `circle-${key}`)
                .attr("cx", d => x(d.date))
                .attr("cy", d => y(d[key]))
                .attr("r", 3)
                .attr("fill", color(key))
                .on("mouseover", function(event, d) {
                    d3.select("body").select(".tooltip")
                        .html(`Date:  <b>${tooltipFormat(d.date)}</b><br>${displayNames[key]} <b>${d[key]}</b>`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px")
                        .transition().duration(200).style("opacity", 0.9);
                })
                .on("mouseout", function() {
                    d3.select("body").select(".tooltip")
                        .transition().duration(500).style("opacity", 0);
                });
        }
    });

    // 3. Draw the x-axis.
    const xAxis = d3.axisBottom(x).tickFormat(tickFormat);
    chartGroup.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .attr("fill", "grey");
}
