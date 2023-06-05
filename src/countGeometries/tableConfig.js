const fieldsConfig = [
  { fieldName: 'id', creator: (table, fieldName) => table.integer(fieldName) },
  {
    fieldName: 'gridIndex',
    creator: (table, fieldName) => table.string(fieldName),
  },
  {
    fieldName: 'datasource',
    creator: (table, fieldName) => table.string(fieldName),
  },
  // {
  //   fieldName: 'opSchelde',
  //   creator: (table, fieldName) => table.boolean(fieldName),
  // },
  {
    fieldName: 'geometry',
    creator: (table, fieldName) =>
      table.specificType(fieldName, 'geometry(GEOMETRY, 4326)').notNullable(),
  },
  {
    fieldName: 'street_object_id',
    creator: (table, fieldName) =>
      table.specificType(fieldName, 'integer'),
  },
];

const primaryKey = ['datasource', 'gridIndex']
//, 'geometry']

module.exports = {
  fieldsConfig,
  primaryKey
};
