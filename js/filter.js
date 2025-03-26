// filter.js – sets up the unified hierarchical filter using Treeselect.

let combinedTreeselect;
let defaultLeafValues = [];

function getAllLeafValues(options) {
    let values = [];
    options.forEach(opt => {
        if (opt.children && opt.children.length > 0) {
            values = values.concat(getAllLeafValues(opt.children));
        } else {
            values.push(opt.value);
        }
    });
    return values;
}

export function initFilters() {
    const options = [
        {
            name: "Aid Workers (KIKA)",
            value: "aid_workers",
            children: [
                {
                    name: "Incident Type",
                    value: "incident_type",
                    children: [
                        { name: "Killed", value: "killed", children: [] },
                        { name: "Injured", value: "injured", children: [] },
                        { name: "Kidnapped", value: "kidnapped", children: [] },
                        { name: "Arrested", value: "arrested", children: [] }
                    ]
                }
            ]
        },
        {
            name: "Explosive Weapons",
            value: "weapons",
            children: [
                {
                    name: "Sector Affected",
                    value: "sector_affected",
                    children: [
                        { name: "Aid Operations", value: "aid_operations", children: [] },
                        { name: "Health care", value: "health_care", children: [] },
                        { name: "Food Security", value: "food_security", children: [] },
                        { name: "Education", value: "education", children: [] },
                        { name: "IDP/refugee protection", value: "idp_refugee_protection", children: [] }
                    ]
                },
                {
                    name: "Launch Type",
                    value: "launch_type",
                    children: [
                        { name: "Air launched", value: "air_launched", children: [] },
                        { name: "Air-launched Plane", value: "air_launched_plane", children: [] },
                        { name: "Air-launched Drone", value: "air_launched_drone", children: [] },
                        { name: "Air-launched Helicopter", value: "air_launched_helicopter", children: [] },
                        { name: "Ground-launched", value: "ground_launched", children: [] },
                        { name: "Directly emplaced", value: "directly_emplaced", children: [] },
                        { name: "Unspecified Launch Method", value: "unspecified_launch_method", children: [] }
                    ]
                }
            ]
        },
        {
            name: "CRSV",
            value: "crsv",
            children: [
                {
                    name: "Type of SV",
                    value: "type_of_sv",
                    children: [
                        { name: "Rape", value: "rape", children: [] },
                        { name: "Sexual slavery", value: "sexual_slavery", children: [] },
                        { name: "Forced prostitution", value: "forced_prostitution", children: [] }
                    ]
                },
                {
                    name: "Survivor/Victim Sex",
                    value: "survivor_sex",
                    children: [
                        { name: "Male", value: "male", children: [] },
                        { name: "Female", value: "female", children: [] }
                    ]
                },
                {
                    name: "Adult or Minor",
                    value: "age_group",
                    children: [
                        { name: "Adult", value: "adult", children: [] },
                        { name: "Minor", value: "minor", children: [] }
                    ]
                }
            ]
        }
    ];

    // Compute all leaf values.
    defaultLeafValues = getAllLeafValues(options);

    combinedTreeselect = new Treeselect({
        parentHtmlContainer: document.querySelector('#combinedFilter'),
        options: options,
        value: defaultLeafValues,  // All options selected by default.
        alwaysOpen: false,
        openLevel: 1,
        showTags: true,
        clearable: true,
        searchable: true,
        placeholder: 'Select filters...',
        isSingleSelect: false,
        grouped: true,
        expandSelected: false,
        saveScrollPosition: true
    });
}

export function addFilterListeners(callback) {
    if (combinedTreeselect && combinedTreeselect.srcElement) {
        combinedTreeselect.srcElement.addEventListener('input', callback);
        combinedTreeselect.srcElement.addEventListener('change', callback);
    }
    const dateInputs = [document.getElementById("startDate"), document.getElementById("endDate")];
    dateInputs.forEach(input => input.addEventListener("change", callback));
}

export function getFilterValues() {
    let selectedFilters = [];
    if (combinedTreeselect) {
        if (typeof combinedTreeselect.getSelectedIds === "function") {
            selectedFilters = combinedTreeselect.getSelectedIds();
        } else if (combinedTreeselect.value) {
            selectedFilters = combinedTreeselect.value;
        }
    }
    const startDate = document.getElementById("startDate").valueAsDate;
    const endDate = document.getElementById("endDate").valueAsDate;
    return {
        filters: selectedFilters,
        startDate,
        endDate
    };
}

export function filterData(data, filters) {
    // If all filters are selected, apply only the date filter.
    if (filters.filters.length === defaultLeafValues.length) {
        return data.filter(d => d.Date >= filters.startDate && d.Date <= filters.endDate);
    }

    // Define leaf groups.
    const aidWorkersLeaves = ["killed", "injured", "kidnapped", "arrested"];
    // For Explosive Weapons:
    const weaponsSectorLeaves = ["aid_operations", "health_care", "food_security", "education", "idp_refugee_protection"];
    const weaponsLaunchLeaves = ["air_launched", "air_launched_plane", "air_launched_drone", "air_launched_helicopter", "ground_launched", "directly_emplaced", "unspecified_launch_method"];
    const crsvLeaves = ["rape", "sexual_slavery", "forced_prostitution", "male", "female", "adult", "minor"];

    // Determine if a top-level dataset is selected.
    const selectedAidWorkers = filters.filters.some(f => aidWorkersLeaves.includes(f));
    const selectedWeapons = filters.filters.some(f => weaponsSectorLeaves.includes(f) || weaponsLaunchLeaves.includes(f));
    const selectedCRSV = filters.filters.some(f => crsvLeaves.includes(f));

    return data.filter(d => {
        // Always apply date filter.
        if (d.Date < filters.startDate || d.Date > filters.endDate) return false;

        let include = false;

        // --- Aid Workers Filtering ---
        if (d.dataset.includes("aid_workers")) {
            if (selectedAidWorkers) {
                let incidentMatch = false;
                if (filters.filters.includes("killed") && d.AidWorkersKilled > 0) incidentMatch = true;
                if (filters.filters.includes("injured") && d.AidWorkersInjured > 0) incidentMatch = true;
                if (filters.filters.includes("kidnapped") && d.AidWorkersKidnapped > 0) incidentMatch = true;
                if (filters.filters.includes("arrested") && d.AidWorkersArrested > 0) incidentMatch = true;
                if (incidentMatch) include = true;
            }
        }

        // --- Explosive Weapons Filtering ---
        if (d.dataset.includes("weapons")) {
            if (selectedWeapons) {
                // Process Sector Affected.
                let sectorList = [];
                try {
                    sectorList = JSON.parse(d.SectorAffected.replace(/'/g, '"'));
                } catch (err) {
                    sectorList = d.SectorAffected.split(",").map(s => s.trim());
                }
                sectorList = sectorList.map(s => s.toLowerCase());

                // Process Launch Type.
                let launchList = [];
                try {
                    launchList = JSON.parse(d.LaunchType.replace(/'/g, '"'));
                } catch (err) {
                    launchList = d.LaunchType.split(",").map(s => s.trim());
                }
                launchList = launchList.map(s => s.toLowerCase());

                // Get active filters for each subgroup.
                let activeSectorFilters = filters.filters.filter(f => weaponsSectorLeaves.includes(f));
                let activeLaunchFilters = filters.filters.filter(f => weaponsLaunchLeaves.includes(f));

                // If the user hasn’t deselected any options in a subgroup,
                // treat that subgroup as not filtering.
                if (activeSectorFilters.length === weaponsSectorLeaves.length) {
                    activeSectorFilters = [];
                }
                if (activeLaunchFilters.length === weaponsLaunchLeaves.length) {
                    activeLaunchFilters = [];
                }

                // For Sector Affected: if active filters exist, require at least one match.
                let sectorMatch = true;
                if (activeSectorFilters.length > 0) {
                    sectorMatch = activeSectorFilters.some(opt => {
                        // For "idp_refugee_protection", match any element containing "protection"
                        if (opt === "idp_refugee_protection") {
                            return sectorList.some(s => s.indexOf("protection") !== -1);
                        }
                        // Otherwise, convert underscores to space.
                        let key = opt.replace(/_/g, " ");
                        return sectorList.includes(key);
                    });
                }

                // For Launch Type: if active filters exist, require at least one match.
                let launchMatch = true;
                if (activeLaunchFilters.length > 0) {
                    launchMatch = activeLaunchFilters.some(opt => {
                        // For "air_launched", match any value starting with "air-launched"
                        if (opt === "air_launched") {
                            return launchList.some(item => item.indexOf("air-launched") !== -1);
                        } else if (opt === "air_launched_plane") {
                            // Remove colon for flexibility.
                            return launchList.some(item => item.replace(/:/g, "").indexOf("air-launched plane") !== -1);
                        } else if (opt === "air_launched_drone") {
                            return launchList.some(item => item.replace(/:/g, "").indexOf("air-launched drone") !== -1);
                        } else if (opt === "air_launched_helicopter") {
                            return launchList.some(item => item.replace(/:/g, "").indexOf("air-launched helicopter") !== -1);
                        } else if (opt === "ground_launched") {
                            return launchList.some(item => item.indexOf("ground-launched") !== -1);
                        } else if (opt === "directly_emplaced") {
                            return launchList.some(item => item.indexOf("directly emplaced") !== -1);
                        } else if (opt === "unspecified_launch_method") {
                            return launchList.some(item => item.indexOf("unspecified launch method") !== -1);
                        }
                        return false;
                    });
                }

                // For a record to match, it must satisfy the active filters in both subgroups (if any are active).
                let weaponsMatch = true;
                if (activeSectorFilters.length > 0) {
                    weaponsMatch = weaponsMatch && sectorMatch;
                }
                if (activeLaunchFilters.length > 0) {
                    weaponsMatch = weaponsMatch && launchMatch;
                }
                // If any active filter exists in at least one subgroup, use the combined result.
                if ((activeSectorFilters.length > 0 || activeLaunchFilters.length > 0)) {
                    if (weaponsMatch) {
                        include = true;
                    }
                } else {
                    // No active subfilter; include all weapons records.
                    include = true;
                }
            }
        }

        // --- CRSV Filtering ---
        if (d.dataset.includes("crsv")) {
            if (selectedCRSV) {
                let typeOfSVList = d.TypeOfSV.split(",").map(s => s.trim().toLowerCase());
                let sexList = d.SurvivorOrVictimSex.split(",").map(s => s.trim().toLowerCase());
                let ageList = d.AdultOrMinor.split(",").map(s => s.trim().toLowerCase());

                let activeTypeFilters = filters.filters.filter(f =>
                    ["rape", "sexual_slavery", "forced_prostitution"].includes(f)
                );
                let activeSexFilters = filters.filters.filter(f =>
                    ["male", "female"].includes(f)
                );
                let activeAgeFilters = filters.filters.filter(f =>
                    ["adult", "minor"].includes(f)
                );

                let typeMatch = true;
                if (activeTypeFilters.length > 0) {
                    typeMatch = activeTypeFilters.some(opt => {
                        let compare = (opt === "sexual_slavery") ? "sexual slavery" : opt;
                        return typeOfSVList.includes(compare);
                    });
                }

                let sexMatch = true;
                if (activeSexFilters.length > 0) {
                    sexMatch = activeSexFilters.some(opt => sexList.includes(opt));
                }

                let ageMatch = true;
                if (activeAgeFilters.length > 0) {
                    ageMatch = activeAgeFilters.some(opt => ageList.includes(opt));
                }

                if ((activeTypeFilters.length > 0 || activeSexFilters.length > 0 || activeAgeFilters.length > 0) &&
                    typeMatch && sexMatch && ageMatch) {
                    include = true;
                }
            }
        }

        return include;
    });
}
