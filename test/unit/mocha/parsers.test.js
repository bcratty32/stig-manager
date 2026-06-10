import { expect } from 'chai'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const formDataDir = path.resolve(__dirname, '../../../test/api/form-data-files')

// CJS module imported into ESM
import parsers from '../../../api/source/utils/parsers.js'

const { benchmarkFromXccdf, profilesFromXccdf } = parsers

describe('parsers.benchmarkFromXccdf - existing DISA STIG files', () => {

  it('should parse a DISA STIG Manual XCCDF correctly', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'U_VPN_SRG_V1R1_Manual-xccdf.xml'))
    const result = benchmarkFromXccdf(data)
    expect(result.benchmarkId).to.equal('VPN_SRG_TEST')
    expect(result.revision.revisionStr).to.equal('V1R1')
    expect(result.revision.version).to.equal('1')
    expect(result.revision.release).to.equal('1')
    expect(result.revision.benchmarkDate8601).to.equal('2019-07-19')
    expect(result.revision.groups).to.be.an('array').with.length.greaterThan(0)
    expect(result.scap).to.be.false
  })

  it('should preserve DISA rule description fields', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'U_VPN_SRG_V1R1_Manual-xccdf.xml'))
    const result = benchmarkFromXccdf(data)
    const firstRule = result.revision.groups[0].rules[0]
    expect(firstRule.ruleId).to.be.a('string')
    expect(firstRule.vulnDiscussion).to.be.a('string')
    expect(firstRule.severity).to.be.a('string')
  })

  it('should return profiles list from DISA STIG', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'U_VPN_SRG_V1R1_Manual-xccdf.xml'))
    const result = benchmarkFromXccdf(data)
    expect(result.profiles).to.be.an('array').with.length.greaterThan(0)
    expect(result.profiles[0]).to.have.keys(['profileId', 'title'])
  })
})

describe('parsers.benchmarkFromXccdf - SSG XCCDF (standalone)', () => {

  it('should parse SSG XCCDF with non-integer version', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-xccdf.xml'))
    const result = benchmarkFromXccdf(data)
    expect(result.benchmarkId).to.equal('xccdf_org.ssgproject.content_benchmark_RHEL-9')
    expect(result.revision.version).to.equal('0.1.71')
    expect(result.revision.revisionStr).to.equal('V0.1.71R1')
    expect(result.scap).to.be.false
  })

  it('should return all 2 rules when no profile filter', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-xccdf.xml'))
    const result = benchmarkFromXccdf(data)
    const totalRules = result.revision.groups.reduce((n, g) => n + g.rules.length, 0)
    expect(totalRules).to.equal(2)
  })

  it('should return SSG check content as OVAL ID', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-xccdf.xml'))
    const result = benchmarkFromXccdf(data)
    const rule = result.revision.groups[0].rules[0]
    expect(rule.checks).to.be.an('array').with.length.greaterThan(0)
    expect(rule.checks[0].content).to.include('oval:ssg')
  })

  it('should filter to STIG profile rules (2 of 2 selected)', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-xccdf.xml'))
    const profileId = 'xccdf_org.ssgproject.content_profile_stig'
    const result = benchmarkFromXccdf(data, { filterByProfileId: profileId })
    expect(result.revision.revisionStr).to.equal('V0.1.71R1-stig')
    const totalRules = result.revision.groups.reduce((n, g) => n + g.rules.length, 0)
    expect(totalRules).to.equal(2)
  })

  it('should filter to CIS L1 profile rules (1 of 2 selected)', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-xccdf.xml'))
    const profileId = 'xccdf_org.ssgproject.content_profile_cis_l1_server'
    const result = benchmarkFromXccdf(data, { filterByProfileId: profileId })
    expect(result.revision.revisionStr).to.equal('V0.1.71R1-cis_l1_server')
    const totalRules = result.revision.groups.reduce((n, g) => n + g.rules.length, 0)
    expect(totalRules).to.equal(1)
  })

  it('should throw on unknown profileId', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-xccdf.xml'))
    expect(() => benchmarkFromXccdf(data, { filterByProfileId: 'nonexistent' }))
      .to.throw(/Profile "nonexistent" not found/)
  })
})

describe('parsers.benchmarkFromXccdf - SCAP data stream', () => {

  it('should parse SCAP data stream and return scap=true', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-ds.xml'))
    const result = benchmarkFromXccdf(data)
    expect(result.scap).to.be.true
    expect(result.benchmarkId).to.equal('xccdf_org.ssgproject.content_benchmark_RHEL-9-DS')
    expect(result.revision.revisionStr).to.equal('V0.1.71R1')
  })

  it('should return correct rule count from SCAP data stream', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-ds.xml'))
    const result = benchmarkFromXccdf(data)
    const totalRules = result.revision.groups.reduce((n, g) => n + g.rules.length, 0)
    expect(totalRules).to.equal(2)
  })
})

describe('parsers.benchmarkFromXccdf - nested SSG groups', () => {

  it('should collect rules from nested groups into the parent group', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_nested-xccdf.xml'))
    const result = benchmarkFromXccdf(data)
    const totalRules = result.revision.groups.reduce((n, g) => n + g.rules.length, 0)
    expect(totalRules).to.equal(2)
  })

  it('should not crash when a top-level group has no direct rules, only nested ones', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_nested-xccdf.xml'))
    const result = benchmarkFromXccdf(data)
    expect(result.revision.groups).to.be.an('array').with.length.greaterThan(0)
    result.revision.groups.forEach(g => {
      expect(g.rules).to.be.an('array')
    })
  })
})

describe('parsers.profilesFromXccdf', () => {

  it('should return profiles from SSG XCCDF', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-xccdf.xml'))
    const result = profilesFromXccdf(data)
    expect(result.benchmarkId).to.equal('xccdf_org.ssgproject.content_benchmark_RHEL-9')
    expect(result.profiles).to.be.an('array').of.length(2)
    expect(result.profiles[0].profileId).to.equal('xccdf_org.ssgproject.content_profile_stig')
    expect(result.profiles[0].selectedRuleCount).to.equal(2)
    expect(result.profiles[1].profileId).to.equal('xccdf_org.ssgproject.content_profile_cis_l1_server')
    expect(result.profiles[1].selectedRuleCount).to.equal(1)
  })

  it('should return profiles from SCAP data stream', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'SSG_RHEL9_test-ds.xml'))
    const result = profilesFromXccdf(data)
    expect(result.benchmarkId).to.equal('xccdf_org.ssgproject.content_benchmark_RHEL-9-DS')
    expect(result.profiles).to.be.an('array').of.length(1)
  })

  it('should return profiles from DISA STIG (empty description ok)', () => {
    const data = fs.readFileSync(path.join(formDataDir, 'U_VPN_SRG_V1R1_Manual-xccdf.xml'))
    const result = profilesFromXccdf(data)
    expect(result.profiles).to.be.an('array').with.length.greaterThan(0)
    expect(result.profiles[0]).to.have.keys(['profileId', 'title', 'description', 'selectedRuleCount'])
  })
})
