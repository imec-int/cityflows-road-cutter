const config = {
  countGeometries: {
    insert: true,
    inputFile: 'all_data.csv', // change here the ref files for cutting
  },
  segments: {
    insert: true,
    inputFile: 'wegenregister_antwerp.geojson', // change here the street like objects
  },
  performStreetCutting: true,
  downloadResults: true,
  dbConnection: {
    host: 'cityflows-postgis.postgres.database.azure.com',
    port: 5432,
    user: 'aptadmin@cityflows-postgis',
    password: 'road-cutter-1',
    database: 'road_cutter_test',
    ssl: true,
  },
  schema: 'road_cutter',
};

// host: "cityflows-postgis.postgres.database.azure.com",
// port: 5432,
// user: "aptadmin@cityflows-postgis",
// password: "road-cutter-1",
// database: "road_cutter_test",
// ssl: true,

/* k8s */
// host: "localhost",
// port: 5432,
// user: "digitaltwin",
// password: "QouN4PGr6k56B209",
// database: "digitaltwin",

// host: "localhost",
// port: 5432,
// user: "digitaltwin",
// password: "digitaltwin",
// database: "digitaltwin",

/* docker */
// host: "localhost",
// port: 5432,
// user: "postgres",
// password: "rootpass",
// database: "postgres",

module.exports = {
  config,
};
