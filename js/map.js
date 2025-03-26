// map.js – initializes the map and updates markers using a D3 power scale for cluster icon sizes.
// Individual markers are fixed-size, and clusters use lower opacity and are never smaller than individual markers.


export function initMap() {
    // Create the map with max zoom 18 and an initial view at zoom level 3.
    const map = L.map('map', { maxZoom: 18 }).setView([15, 20], 2);

    // Replace with your actual Mapbox access token.
    const mapboxAccessToken = "pk.eyJ1IjoiamVubnlvaCIsImEiOiJjbThrcGg1encxMDg0Mmtwcmk2bTV3Mjl3In0.KsBm9WnBLVV2msEJB6SiUw";

    L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/512/{z}/{x}/{y}?access_token=${mapboxAccessToken}`,
        {
            attribution:
                'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, Imagery © Mapbox',
            maxZoom: 18
        }
    ).addTo(map);

    // Create a marker cluster group with custom icon sizing.
    const markersLayer = L.markerClusterGroup({
        disableClusteringAtZoom: 14, // Show individual markers at zoom >= 14.
        maxClusterRadius: 30,         // Markers cluster only when within 30 pixels.
        iconCreateFunction: function (cluster) {
            const count = cluster.getChildCount();
            // Use a D3 power scale to compute cluster icon size.
            // Here, clusters with 1 marker will have at least 14px, and clusters up to 100 markers scale to 30px.
            const clusterSizeScale = d3.scalePow()
                .exponent(0.3)
                .domain([1, 100])
                .range([14, 30]);
            const size = clusterSizeScale(count);
            return L.divIcon({
                html: `<div class="marker-cluster-icon" style="
                    width: ${size}px; 
                    height: ${size}px; 
                    line-height: ${size}px;
                    background: rgba(178,34,34,0.3);
                    border: 2px solid #e02944;
                    border-radius: 50%;
                    color: #fff;
                    text-align: center;
                    font-weight: bold;
                     font-size: 10px;
                "></div>`,
                className: 'marker-cluster',
                iconSize: L.point(size, size)
            });
        }
    });
    map.addLayer(markersLayer);

    // Create or select a tooltip element.
    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("z-index", 9999);
    }
    return { map, markersLayer, tooltip };
}

export function updateMapMarkers(markersLayer, filteredData, tooltip) {
    markersLayer.clearLayers();

    // For individual markers, use a fixed radius so all single incidents are the same.
    const fixedRadius = 6;

    filteredData.forEach(d => {
        const marker = L.circleMarker([d.Latitude, d.Longitude], {
            radius: fixedRadius,
            fillColor: "#e02944", // Muted red (Firebrick)
            color: "#e02944",
            fillOpacity: 0.7,     // Single markers have higher opacity.
            weight: 0.7
        });

        let popupContent = `<strong>${d.Country}</strong><br>${d.EventDescription}<br><em>Event ID: ${d.SiNDEventID}</em>`;
        marker.bindPopup(popupContent);

        // Hover effect: on mouseover, increase stroke weight and lower fill opacity.
        marker.on('mouseover', function(e) {
            this.setStyle({ weight: 3, fillOpacity: 0.5 });
        });
        marker.on('mouseout', function(e) {
            this.setStyle({ weight: 1, fillOpacity: 0.7 });
        });

        markersLayer.addLayer(marker);
    });
}
