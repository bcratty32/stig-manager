const MigrationHandler = require('./lib/MigrationHandler')

// Change version column from int to varchar(45) in revision and current_rev tables
// to support SSG benchmarks which use non-integer version strings (e.g. "0.1.71").
// Also recreates v_current_rev with benchmarkDateSql as a tiebreaker, since MySQL
// casts dotted strings via (version + 0) — '0.1.71' becomes 0.1 — causing ties
// between SSG revisions of the same benchmark.

const upMigration = [
  `ALTER TABLE revision MODIFY COLUMN \`version\` varchar(45) NOT NULL`,
  `ALTER TABLE current_rev MODIFY COLUMN \`version\` varchar(45) NOT NULL`,
  `CREATE OR REPLACE VIEW v_current_rev AS
    SELECT rr.revId, rr.benchmarkId, rr.version, rr.release, rr.benchmarkDate, rr.benchmarkDateSql,
           rr.status, rr.statusDate, rr.marking, rr.description, rr.active,
           rr.groupCount, rr.ruleCount, rr.lowCount, rr.mediumCount, rr.highCount,
           rr.checkCount, rr.fixCount
    FROM (
      SELECT r.revId, r.benchmarkId, r.version, r.release, r.benchmarkDate, r.benchmarkDateSql,
             r.status, r.statusDate, r.marking, r.description, r.active,
             r.groupCount, r.ruleCount, r.lowCount, r.mediumCount, r.highCount,
             r.checkCount, r.fixCount,
             ROW_NUMBER() OVER (
               PARTITION BY r.benchmarkId
               ORDER BY FIELD(r.status, 'draft', 'accepted') DESC,
                        (r.version + 0) DESC,
                        (r.release + 0) DESC,
                        r.benchmarkDateSql DESC
             ) AS rn
      FROM revision r
    ) rr
    WHERE rr.rn = 1`
]

const downMigration = [
  `CREATE OR REPLACE VIEW v_current_rev AS
    SELECT rr.revId, rr.benchmarkId, rr.version, rr.release, rr.benchmarkDate, rr.benchmarkDateSql,
           rr.status, rr.statusDate, rr.marking, rr.description, rr.active,
           rr.groupCount, rr.ruleCount, rr.lowCount, rr.mediumCount, rr.highCount,
           rr.checkCount, rr.fixCount
    FROM (
      SELECT r.revId, r.benchmarkId, r.version, r.release, r.benchmarkDate, r.benchmarkDateSql,
             r.status, r.statusDate, r.marking, r.description, r.active,
             r.groupCount, r.ruleCount, r.lowCount, r.mediumCount, r.highCount,
             r.checkCount, r.fixCount,
             ROW_NUMBER() OVER (
               PARTITION BY r.benchmarkId
               ORDER BY FIELD(r.status, 'draft', 'accepted') DESC,
                        (r.version + 0) DESC,
                        (r.release + 0) DESC
             ) AS rn
      FROM revision r
    ) rr
    WHERE rr.rn = 1`,
  `ALTER TABLE revision MODIFY COLUMN \`version\` int NOT NULL`,
  `ALTER TABLE current_rev MODIFY COLUMN \`version\` int NOT NULL`
]

const migrationHandler = new MigrationHandler(upMigration, downMigration)
module.exports = {
  up: async (pool) => {
    await migrationHandler.up(pool, __filename)
  },
  down: async (pool) => {
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM revision WHERE version REGEXP '[^0-9]'`
    )
    if (cnt > 0) {
      throw new Error(
        `Cannot downgrade migration 0047: ${cnt} revision(s) have non-integer version strings. Remove SSG benchmarks before downgrading.`
      )
    }
    await migrationHandler.down(pool, __filename)
  }
}
