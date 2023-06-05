const cliProgress = require('cli-progress')

const INSERT_BATCH_SIZE = 1000;

const createTableStructure = async (knex, schema, tableName, fieldsConfig, primaryKey) => {
  await knex.schema.withSchema(schema).dropTableIfExists(tableName);
  await knex.schema.withSchema(schema).createTable(tableName, (table) => {
    fieldsConfig.forEach(({ fieldName, creator }) => creator(table, fieldName));
    table.index("geometry", `${tableName}-geometry-idx`, "GIST");
  });

  if (primaryKey) {
    await knex.schema.withSchema(schema).alterTable(tableName, table => table.primary(primaryKey))
  }
};

const insert = async (knex, schema, tableName, features, tableConfig) => {
  const { fieldsConfig, primaryKey } = tableConfig
  
  await createTableStructure(knex, schema, tableName, fieldsConfig, primaryKey);
  
  const progressBar = new cliProgress.SingleBar({ clearOnComplete: true })
  progressBar.start(features.length, 0)
  
  for (let i = 0; i < features.length; i += INSERT_BATCH_SIZE) {
    progressBar.update(i)
    
    const batch = features.slice(i, i + INSERT_BATCH_SIZE);
    let insert = knex.withSchema(schema).table(tableName).insert(batch)
    if (primaryKey) {
      insert = insert.onConflict(primaryKey).ignore();
    }
    await insert
  }
  
  progressBar.stop()
  console.log(`Data successfully inserted into ${tableName}`);
};

module.exports = insert;
