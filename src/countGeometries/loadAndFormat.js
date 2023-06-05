const path = require('path')
const parse = require('../utils/csv-parse');

const loadAndFormat = async (knex, filename) => {
  // load
  const polygons = await parse(path.join('data', filename))

  // format
  const formattedPolygons = polygons.map((polygon, i) => {

    // const geometry = JSON.parse(polygon.locationrange.replace(/'/g, '"'));
    const geometry = polygon.locationrange;

    // inspiration from https://github.com/stepankuzmin/geojson2postgis/blob/master/src/geojson2postgis.js
    const rawGeometry = knex.raw(
      `st_setsrid(st_force2D(st_geomfromText('${geometry}')), 4326)`,
    );

    return {
      id: i,
      gridIndex: polygon.index,
      datasource: polygon.data_source,
      // opSchelde: polygon.opSchelde,
      geometry: rawGeometry,
      street_object_id: polygon.refRoadSegment || null,
    };
  });

  return formattedPolygons;
};

module.exports = loadAndFormat;
