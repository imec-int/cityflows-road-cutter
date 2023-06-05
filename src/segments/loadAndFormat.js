const fs = require('fs')
const path = require('path')
const { stringify } = require('wkt');

const loadAndFormat = (knex, file = 'step2.json') => {
  // load
  const filepath = path.join('data', file)
  const rawData = fs.readFileSync(filepath, 'utf8');
  const data = JSON.parse(rawData);
  const features = data.features;

  // format
  const formattedSegments = features.map(feature => {
    const geometry = feature.geometry;
    const wkt = stringify(geometry);
    const rawGeometry = knex.raw(`st_geomfromtext('${wkt}', 4326)`);

    return {
      id: feature.properties.WS_OIDN,
      originalId: feature.properties.WS_OIDN,
      geometry: rawGeometry,
    };
  });

  return formattedSegments;
};

module.exports = loadAndFormat;
