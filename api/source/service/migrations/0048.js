const MigrationHandler = require('./lib/MigrationHandler')

// Create scap_benchmark_map table to replace the hardcoded SCAP-to-DISA benchmark
// map previously served by GET /stigs/scap-maps. Seeded with the legacy entries
// plus SSG (SCAP Security Guide) benchmark IDs so OpenSCAP results can be mapped
// to their DISA STIG counterparts. Admin-managed via PUT /stigs/scap-maps.

const upMigration = [
  `CREATE TABLE \`scap_benchmark_map\` (
    \`scapBenchmarkId\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    \`benchmarkId\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    PRIMARY KEY (\`scapBenchmarkId\`),
    KEY \`idx_sbm_benchmarkId\` (\`benchmarkId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `INSERT INTO scap_benchmark_map (scapBenchmarkId, benchmarkId) VALUES
    ('CAN_Ubuntu_18-04_STIG', 'U_CAN_Ubuntu_18-04_STIG'),
    ('Mozilla_Firefox_RHEL', 'Mozilla_Firefox'),
    ('Mozilla_Firefox_Windows', 'Mozilla_Firefox'),
    ('MOZ_Firefox_Linux', 'MOZ_Firefox_STIG'),
    ('MOZ_Firefox_Windows', 'MOZ_Firefox_STIG'),
    ('Solaris_10_X86_STIG', 'Solaris_10_X86'),
    ('xccdf_org.ssgproject.content_benchmark_RHEL-8', 'RHEL_8_STIG'),
    ('xccdf_org.ssgproject.content_benchmark_RHEL-9', 'RHEL_9_STIG'),
    ('xccdf_org.ssgproject.content_benchmark_OL-8', 'OL_8_STIG'),
    ('xccdf_org.ssgproject.content_benchmark_OL-9', 'OL_9_STIG'),
    ('xccdf_org.ssgproject.content_benchmark_UBUNTU_20-04', 'CAN_Ubuntu_20-04_LTS_STIG'),
    ('xccdf_org.ssgproject.content_benchmark_UBUNTU_22-04', 'CAN_Ubuntu_22-04_LTS_STIG'),
    ('xccdf_org.ssgproject.content_benchmark_SLE-15', 'SLES_15_STIG'),
    ('xccdf_org.ssgproject.content_benchmark_FIREFOX', 'MOZ_Firefox_STIG')`
]

const downMigration = [
  `DROP TABLE IF EXISTS scap_benchmark_map`
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
