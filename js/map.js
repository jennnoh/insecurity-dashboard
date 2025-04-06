// map.js – initializes the map and updates markers using a D3 power scale for cluster icon sizes.
// Individual markers are fixed-size, and clusters use lower opacity and are never smaller than individual markers.


export function initMap() {
    // Create the map with max zoom 18 and an initial view at zoom level 3.
    const map = L.map('map', { maxZoom: 14, zoomControl: false  }).setView([15, -65], 2);
    L.control.zoom({ position: 'topright' }).addTo(map);


// #TODO: fix the reset button
    // Create a custom control for the reset button.
    const ResetControl = L.Control.extend({
        options: {
            position: 'topright'  // Position it in the same corner as the zoom control.
        },
        onAdd: function(map) {
            // Create a container with similar styling to the default controls.
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            // Add some spacing so it's below the zoom control.
            container.style.marginTop = '8px';

            // Create the reset button.
            var button = L.DomUtil.create('a', '', container);
            button.innerHTML = '<i class="fas fa-redo"></i>';
            button.href = '#';
            button.title = 'Reset view';

            // Prevent click events from propagating to the map.
            void L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                // Reset the view to the original coordinates and zoom level.
                map.setView([15, -65], 2);
            });

            return container;
        }
    });

    // Add the reset control to the map.
    map.addControl(new ResetControl());


    // Replace with your actual Mapbox access token.
    const mapboxAccessToken = "pk.eyJ1IjoiamVubnlvaCIsImEiOiJjbThrcGg1encxMDg0Mmtwcmk2bTV3Mjl3In0.KsBm9WnBLVV2msEJB6SiUw";

    L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/512/{z}/{x}/{y}?access_token=${mapboxAccessToken}`,
        {
            attribution:
                'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, Imagery © Mapbox',
            maxZoom: 14
        }
    ).addTo(map);


    // Create a marker cluster group with custom icon sizing.
    const markersLayer = L.markerClusterGroup({
        disableClusteringAtZoom: 14, // Show individual markers at zoom >= 14.
        maxClusterRadius: 30,         // Markers cluster only when within 30 pixels.
        showCoverageOnHover: false,
        spiderLegPolylineOptions: {
            weight: 0,
            opacity: 0
        },
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
    window.myMap = map;

    // Create a custom legend control positioned in the bottom-right.
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {
        // Create a container (div) for the legend.
        const div = L.DomUtil.create('div', 'info legend');

        // Build the legend HTML.
        // We replicate the styles of single vs. clustered attacks from your markers:
        div.innerHTML = `
      <div style="
        background-color: white;
        padding: 6px 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 0.8rem;
        color: #555;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 6px;">
          <!-- Single Attack: solid red circle -->
          <span style="
            display: inline-block;
            width: 12px;
            height: 12px;
            margin-right: 8px;
            border-radius: 50%;
            background-color: #e02944;
          "></span>
          Single Incidents
        </div>
        <div style="display: flex; align-items: center;">
          <!-- Grouped Attacks: semi-transparent fill with darker border -->
          <span style="
            display: inline-block;
            width: 12px;
            height: 12px;
            margin-right: 8px;
            border-radius: 50%;
            background-color: rgba(178,34,34,0.3);
            border: 2px solid #e02944;
          "></span>
          Grouped Incidents
        </div>
      </div>
    `;
        return div;
    };

// Finally, add the legend to the map.
    legend.addTo(map);


    return { map, markersLayer, tooltip };
}

export function updateMapMarkers(markersLayer, filteredData, tooltip) {
    markersLayer.clearLayers();

    // For individual markers, use a fixed radius so all single incidents are the same.
    const fixedRadius = 3;

    filteredData.forEach(d => {
        const marker = L.circleMarker([d.Latitude, d.Longitude], {
            radius: fixedRadius,
            fillColor: "#e02944", // Muted red (Firebrick)
            color: "#e02944",
            fillOpacity: 0.7,     // Single markers have higher opacity.
            weight: 0.7
        });

        let popupContent = `<strong>${d.Country}</strong><br><br>${d.EventDescription}<br><br><em>Event ID: ${d.SiNDEventID}</em>`;
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

