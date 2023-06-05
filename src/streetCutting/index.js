const queries = require('./queries')

const prepareStreetCuttingData = async (knex, schema) => {
  console.log('Computing street segments')
  await queries.create_street_segments(knex, schema)

  console.log('Computing intersections');
  await queries.create_intersections(knex, schema)

  console.log('street cutting successful!');
}

module.exports = { prepareStreetCuttingData }