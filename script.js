/*
AI DISCLOSURE:
Used LLM Chat GPT for assistance:

Html: Formating, help implementation of: legend, datalist(decades), import of topojson library


Style: Initial version ai generated and by promting a more useful colour scheme iteratively adapted with Ai

D3 + JS: idea of : function normalizeCountry, world json projection, html parts in this code, 
                    bidirectional highligthing of map and list, formating + styles, debugging,
*/

const width = 800, height = 600;

let state = {
    selectedYear: 2024,
    activeRaceId: null
};

function normalizeCountry(name) {
    const mapping = {
        "UK": "United Kingdom", "USA": "United States of America", 
        "UAE": "United Arab Emirates", "Korea": "South Korea"
    };
    return mapping[name] || name;
}

let mapGroup, projection, countriesPaths, pointsGroup;

d3.json("./world.json").then(map => { //*https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json*/
    d3.csv("./races.csv").then(races => {
        d3.csv("./circuits.csv").then(circuits => {
            init(map, races, circuits);
        });
    });
});

function init(mapData, racesData, circuitsData) {
    console.log("Races Data:", racesData);
    console.log("Map Data loaded:", mapData);
    console.log("circuitData:", circuitsData);
    const circuitsMap = new Map(circuitsData.map(c => [c.circuitId, c]));
    const allRaces = racesData.map(race => {
        const circuit = circuitsMap.get(race.circuitId);

        return {
            id: race.raceId,
            year: +race.year,
            round: +race.round,
            name: race.name,
            circuitName: circuit ? circuit.name : "Unknown",
            country: normalizeCountry(circuit ? circuit.country : ""),
            lat: circuit ? +circuit.lat : 0,
            lng: circuit ? +circuit.lng : 0
        };
    }).sort((a, b) => a.round - b.round);

    const allRacingCountries = new Set(allRaces.map(d => d.country));

    setupControls(allRaces);

    createMap(mapData, allRacingCountries);
    
    update(allRaces);
}


function setupControls(allRaces) {
    const slider = d3.select("#yearSlider");
    const input = d3.select("#yearInput");

    function onYearChange(val) {
        state.selectedYear = +val;
        slider.property("value", state.selectedYear);
        input.property("value", state.selectedYear);
        update(allRaces);
    }

    slider.on("input", function() { onYearChange(this.value); });
    input.on("change", function() { onYearChange(this.value); });
}



function createMap(worldData, allRacingCountries) {
    const svg = d3.select("#map").append("svg")
        .attr("viewBox", [0, 0, width, height]);

    const zoom = d3.zoom()
        .scaleExtent([1, 20])
        .on("zoom", (e) => {
            mapGroup.attr("transform", e.transform);
            pointsGroup.selectAll("circle")
                .attr("r", 6 / e.transform.k)
                .attr("stroke-width", 1 / e.transform.k);
        });

    svg.call(zoom);
    mapGroup = svg.append("g");

    projection = d3.geoMercator().scale(125)
    .translate([width / 2, height / 1.5]);
        

    const path = d3.geoPath().projection(projection);

    const countries = topojson.feature(worldData, worldData.objects.countries).features;

    countriesPaths = mapGroup.selectAll("path")
        .data(countries)
        .join("path")
        .attr("class", d => allRacingCountries.has(d.properties.name) ? "country has-history" : "country")
        .attr("d", path);

    pointsGroup = mapGroup.append("g");

    svg.on("click", () => deselectAll());
}




function update(allRaces) {
    const currentRaces = allRaces.filter(d => d.year === state.selectedYear);
    const activeCountries = new Set(currentRaces.map(d => d.country));

    d3.select("#yearDisplay").text(state.selectedYear);

    countriesPaths.classed("active-season", d => activeCountries.has(d.properties.name));

    const zoomLevel = d3.zoomTransform(d3.select("#map svg").node()).k;

    const circles = pointsGroup.selectAll(".race-point")
        .data(currentRaces, d => d.id);

    circles.exit().remove();

    circles.enter()
        .append("circle")
        .attr("class", "race-point")
        .attr("r", 6 / zoomLevel)
        .attr("fill", "#673ab7")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1 / zoomLevel)
        .attr("cursor", "pointer")
        .merge(circles) 
        .attr("cx", d => projection([d.lng, d.lat])[0])
        .attr("cy", d => projection([d.lng, d.lat])[1])
        .attr("fill", d => d.id === state.activeRaceId ? "#ff1744" : "#673ab7")
        .on("click", (e, d) => {
            e.stopPropagation();
            selectRace(d);
        });


    renderList(currentRaces);
}

function renderList(races) {
    const list = d3.select("#race-list");
    list.html("");

    const items = list.selectAll("li")
        .data(races)
        .enter()
        .append("li")
        .attr("class", "race-item")
        .attr("id", d => `list-item-${d.id}`)
        .on("click", (e,d) => selectRace(d));

    items.append("span")
        .style("width", "50px")
        .text(d => d.round);
    
    items.append("span")
        .style("font-weight", "bold")
        .text(d => d.name);

    items.append("span")
        .style("font-size", "0.9em")
        .style("color", "#666")
        .text(d => d.circuitName);

    if(state.activeRaceId) {
        d3.select(`#list-item-${state.activeRaceId}`).classed("selected", true);
    }
}


function selectRace(raceData) {
    state.activeRaceId = raceData.id;

    
    d3.selectAll(".race-item").classed("selected", false);

    const listItem = d3.select(`#list-item-${raceData.id}`).classed("selected", true);
    
    if(listItem.node()) {
        listItem.node().scrollIntoView({ behavior: "smooth", block: "center" });
    }

    pointsGroup.selectAll("circle")
        .attr("fill", d => d.id === raceData.id ? "#ff1744" : "#673ab7");

    showTooltip(raceData);
}

function showTooltip(d) {
    const tooltip = d3.select("#tooltip");
    
   
    const coords = projection([d.lng, d.lat]);
    const transform = d3.zoomTransform(d3.select("#map svg").node());
    
    const screenX = coords[0] * transform.k + transform.x;
    const screenY = coords[1] * transform.k + transform.y;

    tooltip.classed("hidden", false)
        .html(`
            <strong>${d.name}</strong><br>
            Circuit: ${d.circuitName}<br>
            Race Number: ${d.round}<br>
            Country: ${d.country}
        `)
        
        .style("left", (screenX - 50) + "px") 
        .style("top", screenY + "px");
}

function deselectAll() {
    state.activeRaceId = null;
    d3.selectAll(".race-item").classed("selected", false);
    pointsGroup.selectAll("circle").attr("fill", "#673ab7");
    d3.select("#tooltip").classed("hidden", true);
}