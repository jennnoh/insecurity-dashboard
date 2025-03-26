// barChart.js – builds/updates the line chart with overlaid total bars and header.
export function updateBarChart(filteredData, prelimFiltered, filterValues) {
    // Update header.
    document.getElementById("barChartHeader").innerHTML =
        `<span class="header-number">${filteredData.length}</span> of <span class="header-total">${prelimFiltered.length}</span> total incidents<br>` +
        `happened between <span class="header-date">${filterValues.startDate.toLocaleDateString()}</span> and <span class="header-date">${filterValues.endDate.toLocaleDateString()}</span>`;

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
        if (d.dataset.includes("aid_workers")) addCount(d.Date, "aid_workers");
        if (d.dataset.includes("weapons")) addCount(d.Date, "weapons");
        if (d.dataset.includes("crsv")) addCount(d.Date, "crsv");
    });
    const aggregatedData = Object.values(countsByBucket).sort((a, b) => a.date - b.date);
    // Compute total for each bucket.
    aggregatedData.forEach(d => {
        d.total = d.aid_workers + d.weapons + d.crsv;
    });

    // Remove previous chart.
    d3.select("#chartContainer").select("svg").remove();

    const margin = { top: 10, right: 10, bottom: 40, left: 30 };
    const containerWidth = document.getElementById("chartContainer").clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#chartContainer")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Use a time scale for x.
    const x = d3.scaleTime()
        .domain(d3.extent(aggregatedData, d => d.date))
        .range([0, width]);

    // y scale based on the maximum total incidents.
    const maxTotal = d3.max(aggregatedData, d => d.total);
    const y = d3.scaleLinear()
        .domain([0, maxTotal])
        .nice()
        .range([height, 0]);

    // 1. Draw the bar chart for total incidents (light gray).
    // Compute a "band width" based on the time buckets:
    const numBuckets = aggregatedData.length;
    const barWidth = width / numBuckets * 0.8; // 80% of bucket width
    svg.selectAll(".bar")
        .data(aggregatedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.date) - barWidth/2)
        .attr("y", d => y(d.total))
        .attr("width", barWidth)
        .attr("height", d => height - y(d.total))
        .attr("fill", "#ccc")
        .on("mouseover", function(event, d) {
            const tooltipSelection = d3.select("body").select(".tooltip");
            tooltipSelection.html(`Date: ${d.date.toLocaleDateString()}<br>Total: ${d.total}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px")
                .transition().duration(200).style("opacity", 0.9);
        })
        .on("mouseout", function() {
            d3.select("body").select(".tooltip").transition().duration(500).style("opacity", 0);
        });

    // 2. Draw line charts for each dataset.
    const datasets = ["aid_workers", "weapons", "crsv"];
    const color = d3.scaleOrdinal()
        .domain(datasets)
        .range(["#66c2a5", "#fc8d62", "#8da0cb"]);
    // For each dataset, create a line generator.
    datasets.forEach(key => {
        const lineGenerator = d3.line()
            .x(d => x(d.date))
            .y(d => y(d[key]))
            .curve(d3.curveMonotoneX); // Smooth lines.
        // Draw the line.
        svg.append("path")
            .datum(aggregatedData)
            .attr("fill", "none")
            .attr("stroke", color(key))
            .attr("stroke-width", 2)
            .attr("d", lineGenerator);

        // Add circles at each data point for tooltips.
        svg.selectAll(`.circle-${key}`)
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
                    .html(`Date: ${d.date.toLocaleDateString()}<br>${key}: ${d[key]}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px")
                    .transition().duration(200).style("opacity", 0.9);
            })
            .on("mouseout", function() {
                d3.select("body").select(".tooltip").transition().duration(500).style("opacity", 0);
            });
    });

    // Draw x-axis.
    const xAxis = d3.axisBottom(x).tickFormat(tickFormat);
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .attr("fill", "grey");

    // Draw y-axis.
    const yAxis = d3.axisLeft(y).ticks(5);
    svg.append("g")
        .call(yAxis)
        .selectAll("text")
        .attr("fill", "grey");
}
