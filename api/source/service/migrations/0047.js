const MigrationHandler = require('./lib/MigrationHandler')

// Change version column from int to varchar(45) in revision and current_rev tables
// to support SSG benchmarks which use non-integer version strings (e.g. "0.1.71").
// The v_current_rev view sort uses (version + 0) which still works for integer strings
// and degrades gracefully to 0 for dotted versions.

const upMigration = [
  `ALTER TABLE revision MODIFY COLUMN \`version\` varchar(45) NOT NULL`,
  `ALTER TABLE current_rev MODIFY COLUMN \`version\` varchar(45) NOT NULL`
]

const downMigration = [
  `ALTER TABLE revision MODIFY COLUMN \`version\` int NOT NULL`,
  `ALTER TABLE current_rev MODIFY COLUMN \`version\` int NOT NULL`
]

const migrationHandler = new MigrationHandler(upMigration, downMigration)
module.exports = {
  up: async (pool) => {
    await migrationHandler.up(pool, __filename)
  },
  down: async (pool) => {
    await migrationHandler.down(pool, __filename)
  }
}
