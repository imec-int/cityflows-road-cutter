const fieldsConfig = [
  { fieldName: 'id', creator: (table, fieldName) => table.integer(fieldName) },
  {
    fieldName: 'originalId',
    creator: (table, fieldName) => table.integer(fieldName),
  },
  {
    fieldName: 'geometry',
    creator: (table, fieldName) =>
      table.specificType(fieldName, 'geometry(GEOMETRY, 4326)').notNullable(),
  }
];

module.exports = {
  fieldsConfig
};
