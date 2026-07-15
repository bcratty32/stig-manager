const MigrationHandler = require('./lib/MigrationHandler')

// Change version column from int to varchar(45) in revision and current_rev tables
// to support SSG benchmarks which use non-integer version strings (e.g. "0.1.71").
//
// Also recreates v_current_rev and v_latest_rev. The previous ORDER BY used
// (version + 0) / (release + 0), which raises ER_TRUNCATED_WRONG_VALUE in strict
// mode when the view feeds an INSERT ... SELECT (as insertManualBenchmark does)
// and the column holds a non-numeric string like '0.1.71' or '1-stig'. The new
// ordering extracts the leading numeric prefix with REGEXP_SUBSTR before casting,
// which never errors, and adds benchmarkDateSql as a tiebreaker for revisions
// whose numeric prefixes compare equal (e.g. multiple SSG 0.1.x releases).

const versionSort = `CAST(REGEXP_SUBSTR(r.version, '^[0-9]+([.][0-9]+)?') AS DECIMAL(18,6)) DESC`
const releaseSort = `CAST(REGEXP_SUBSTR(r.\`release\`, '^[0-9]+([.][0-9]+)?') AS DECIMAL(18,6)) DESC`

const upMigration = [
  `ALTER TABLE revision MODIFY COLUMN \`version\` varchar(45) NOT NULL`,
  `ALTER TABLE current_rev MODIFY COLUMN \`version\` varchar(45) NOT NULL`,
  `ALTER TABLE review MODIFY COLUMN \`ruleId\` varchar(255) DEFAULT NULL`,
  `ALTER TABLE review_history MODIFY COLUMN \`ruleId\` varchar(255) DEFAULT NULL`,
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
                        ${versionSort},
                        ${releaseSort},
                        r.benchmarkDateSql DESC
             ) AS rn
      FROM revision r
    ) rr
    WHERE rr.rn = 1`,
  `CREATE OR REPLACE VIEW v_latest_rev AS
    SELECT rr.revId, rr.benchmarkId, CONCAT('V', rr.version, 'R', rr.release) AS revisionStr
    FROM (
      SELECT r.revId, r.benchmarkId, r.version, r.release,
             ROW_NUMBER() OVER (
               PARTITION BY r.benchmarkId
               ORDER BY FIELD(r.status, 'draft', 'accepted') DESC,
                        ${versionSort},
                        ${releaseSort},
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
  `CREATE OR REPLACE VIEW v_latest_rev AS
    SELECT rr.revId, rr.benchmarkId, CONCAT('V', rr.version, 'R', rr.release) AS revisionStr
    FROM (
      SELECT r.revId, r.benchmarkId, r.version, r.release,
             ROW_NUMBER() OVER (
               PARTITION BY r.benchmarkId
               ORDER BY FIELD(r.status, 'draft', 'accepted') DESC,
                        (r.version + 0) DESC,
                        (r.release + 0) DESC
             ) AS rn
      FROM revision r
    ) rr
    WHERE rr.rn = 1`,
  `ALTER TABLE review MODIFY COLUMN \`ruleId\` varchar(45) DEFAULT NULL`,
  `ALTER TABLE review_history MODIFY COLUMN \`ruleId\` varchar(45) DEFAULT NULL`,
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
    const [[{ longRuleIds }]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM review WHERE CHAR_LENGTH(ruleId) > 45) +
              (SELECT COUNT(*) FROM review_history WHERE CHAR_LENGTH(ruleId) > 45) AS longRuleIds`
    )
    if (longRuleIds > 0) {
      throw new Error(
        `Cannot downgrade migration 0047: ${longRuleIds} review record(s) have ruleIds longer than 45 characters. Remove SSG reviews before downgrading.`
      )
    }
    await migrationHandler.down(pool, __filename)
  }
}
