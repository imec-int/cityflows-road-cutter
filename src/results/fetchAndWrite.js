const fs = require("fs");
const fetchResults = require("./fetchResults");
const jsonToCsv = require("./parser");

async function fetchAndWrite(knex, schema, path = "output") {
  try {
    console.log("Start fetching results from database");
    const results = await fetchResults(knex, schema);

    console.log(results.segments.rows.length, `segment rows found`);
    console.log(
      results.intersections.rows.length,
      `polygons intersections found`
    );
    let intersectionsCSV = jsonToCsv(results.intersections.rows);
    let segmentsCSV = jsonToCsv(results.segments.rows);

    console.log("writing results to ", path);
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
    fs.writeFileSync(path + "/intersections.csv", intersectionsCSV);
    fs.writeFileSync(path + "/street_segments.csv", segmentsCSV);
  } catch (e) {
    throw new Error("failed to write", e);
  }
}

module.exports = fetchAndWrite;
