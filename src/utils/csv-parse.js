const Parse = require('csv-parse');
const fs = require('fs');

const parse = async (filename) => {
	const readStream = fs.createReadStream(filename);

	const parser = Parse({
		columns: true,
		skip_empty_lines: true,
	})

	const linesIterator = readStream.pipe(parser)

	const lines = []
	for await (const line of linesIterator) {
		lines.push(line)
	}

	return lines
}

module.exports = parse
