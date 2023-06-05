const papaparse = require('papaparse')

function jsonToCsv(values, config) {
  try {
    const csv = papaparse.unparse(values, {
      delimiter: ',',
      ...config,
    });

    return csv;
  } catch (error) {
    console.log('Error: while parsing json to csv', error);
  }
}

module.exports = jsonToCsv;