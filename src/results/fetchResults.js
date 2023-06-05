const queries = require('../streetCutting/queries');



const fetchResults = async (knex, schema) => {
  try {
    const intProm = queries.fetch_intersection_connected_segments(knex, schema);
    const segProm = queries.fetch_street_segments(knex, schema);
    const [intersections, segments] = await Promise.all([intProm, segProm]);
    console.log('Data fetched from database.');
    return { intersections, segments };
  } catch (e) {
    throw new Error(`Failed to fetch road cutter results from the database. ${e.message}`);
  }
}

module.exports = fetchResults;