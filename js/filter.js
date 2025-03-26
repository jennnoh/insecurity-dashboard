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
                        { name: "Protection", value: "protection", children: [] }
                    ]
                },
                {
                    name: "Launch Type",
                    value: "launch_type",
                    children: [
                        { name: "Air-launched (drone, plane, helicopter)", value: "air_launched", children: [] },
                        { name: "Ground-launched", value: "ground_launched", children: [] },
                        { name: "Directly emplaced", value: "directly_emplaced", children: [] }
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
        // Try to use getSelectedIds if available; otherwise fallback to combinedTreeselect.value.
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
    if (filters.filters.length === defaultLeafValues.length) {
        return data.filter(d => d.Date >= filters.startDate && d.Date <= filters.endDate);
    }
    return data.filter(d => {
        if (d.Date < filters.startDate || d.Date > filters.endDate) return false;
        let include = false;
        if (d.dataset.includes("aid_workers")) {
            if (filters.filters.includes("killed") && d.AidWorkersKilled > 0) include = true;
            if (filters.filters.includes("injured") && d.AidWorkersInjured > 0) include = true;
            if (filters.filters.includes("kidnapped") && d.AidWorkersKidnapped > 0) include = true;
            if (filters.filters.includes("arrested") && d.AidWorkersArrested > 0) include = true;
        }
        if (d.dataset.includes("weapons")) {
            if (filters.filters.includes("aid_operations") && d.SectorAffected.includes("Aid Operations")) include = true;
            if (filters.filters.includes("health_care") && d.SectorAffected.includes("Health care")) include = true;
            if (filters.filters.includes("food_security") && d.SectorAffected.includes("Food Security")) include = true;
            if (filters.filters.includes("education") && d.SectorAffected.includes("Education")) include = true;
            if (filters.filters.includes("protection") && d.SectorAffected.includes("Protection")) include = true;
            if (filters.filters.includes("air_launched") && d.LaunchType.includes("Air-launched")) include = true;
            if (filters.filters.includes("ground_launched") && d.LaunchType.includes("Ground-launched")) include = true;
            if (filters.filters.includes("directly_emplaced") && d.LaunchType.includes("Directly emplaced")) include = true;
        }
        if (d.dataset.includes("crsv")) {
            if (filters.filters.includes("rape") && d.TypeOfSV.includes("Rape")) include = true;
            if (filters.filters.includes("sexual_slavery") && d.TypeOfSV.includes("Sexual slavery")) include = true;
            if (filters.filters.includes("forced_prostitution") && d.TypeOfSV.includes("Forced prostitution")) include = true;
            if (filters.filters.includes("male") && d.SurvivorOrVictimSex.includes("Male")) include = true;
            if (filters.filters.includes("female") && d.SurvivorOrVictimSex.includes("Female")) include = true;
            if (filters.filters.includes("adult") && d.AdultOrMinor.includes("Adult")) include = true;
            if (filters.filters.includes("minor") && d.AdultOrMinor.includes("Minor")) include = true;
        }
        return include;
    });
}
