const { config } = require("./config");
const insert = require("./insertPostGIS");
const { prepareStreetCuttingData } = require("./streetCutting/index");
const {
  loadAndFormat: loadAndFormatCountGeometries,
  tableConfig: countGeometriesTableConfig,
} = require("./countGeometries");
const {
  loadAndFormat: loadAndFormatSegments,
  tableConfig: segmentsTableConfig,
} = require("./segments");
const fetchAndWrite = require("./results/fetchAndWrite");
const {
  initialize_schema,
  install_postgis,
} = require('./streetCutting/queries');

const knex = require("knex")({
  client: "pg",
  connection: config.dbConnection
});

const main = async () => {
  try {
    await install_postgis(knex)
  } catch (e) { console.log('postgis already installed') };

  await initialize_schema(knex, config.schema)

  if (config.countGeometries.insert) {
    const polygons = await loadAndFormatCountGeometries(knex, config.countGeometries.inputFile);
    await insert(knex, config.schema, "count_geometries", polygons, countGeometriesTableConfig);
  }

  if (config.segments.insert) {
    const segments = loadAndFormatSegments(knex, config.segments.inputFile);
    await insert(knex, config.schema, "segments", segments, segmentsTableConfig);
  }

  if (config.performStreetCutting) {
    await prepareStreetCuttingData(knex, config.schema);
  }

  if (config.downloadResults) {
    await fetchAndWrite(knex, config.schema);
  }
};

main()
  .then(() => {
    console.log("Success !");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
