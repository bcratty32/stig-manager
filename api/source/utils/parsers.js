const {XMLParser} = require('fast-xml-parser')
const he = require('he')

function makeXmlParser() {
  return new XMLParser({
    allowBooleanAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "_",
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: { enabled: true, maxTotalExpansions: 200000 },
    isArray: (name, jpath, isLeafNode, isAttribute) => !isAttribute,
    alwaysCreateTextNode: true,
    tagValueProcessor: (name, value) => he.decode(value)
  })
}

function extractBenchmarkFromParsed(j) {
  if (j['data-stream-collection']?.[0]) {
    const components = j['data-stream-collection'][0].component
    const candidate = components?.find(component => 'Benchmark' in component)
    if (candidate?.Benchmark?.[0]) {
      return { bIn: candidate.Benchmark[0], isScap: true }
    }
    throw new Error("Cannot parse SCAP data stream: no Benchmark element found.")
  }
  if (j.Benchmark?.[0]) {
    return { bIn: j.Benchmark[0], isScap: false }
  }
  throw new Error("Cannot parse XML document as STIG, SCAP, or SSG benchmark.")
}

function parseReleaseInfo(bIn) {
  const plainTexts = bIn['plain-text'] || []
  const releaseText = plainTexts.find(pt => pt.id === 'release-info')?._ ||
                      plainTexts[0]?._ || ''
  const releaseMatch = /Release:\s+(\S+)\s+Benchmark Date:\s+(.*)/g.exec(releaseText)
  if (releaseMatch) {
    const [, release, benchmarkDate] = releaseMatch
    return { release, benchmarkDate, benchmarkDate8601: benchmarkDateTo8601(benchmarkDate) }
  }
  // Fallback for SSG and other non-DISA benchmarks
  const release = bIn.version?.[0]?._ || '1'
  const benchmarkDate = bIn.status?.[0]?.date || null
  return { release, benchmarkDate, benchmarkDate8601: benchmarkDate }
}

function benchmarkDateTo8601(benchmarkDate) {
  const monthToNum = {
    'Jan': '01', 'January': '01',
    'Feb': '02', 'February': '02',
    'Mar': '03', 'March': '03',
    'Apr': '04', 'April': '04',
    'May': '05',
    'Jun': '06', 'June': '06',
    'Jul': '07', 'July': '07',
    'Aug': '08', 'August': '08',
    'Sep': '09', 'Sept': '09', 'September': '09',
    'Oct': '10', 'October': '10',
    'Nov': '11', 'November': '11',
    'Dec': '12', 'December': '12'
  }
  const [day, monStr, year] = benchmarkDate.split(/\s+/)
  return `${year}-${monthToNum[monStr]}-${day}`
}

function ssgProfileShortName(profileId) {
  const match = profileId.match(/_profile_(.+)$/)
  return match ? match[1] : profileId
}

module.exports.benchmarkFromXccdf = function (xccdfData, { filterByProfileId } = {}) {
  try {
    const parser = makeXmlParser()
    const j = parser.parse(xccdfData.toString())
    const { bIn, isScap } = extractBenchmarkFromParsed(j)

    const profileDefs = (bIn.Profile || []).map(profile => ({
      profileId: profile.id,
      title: profile.title?.[0]?._ || profile.id,
      selectedIds: new Set(
        (profile.select || [])
          .filter(s => s.selected === 'true' || s.selected === true)
          .map(s => s.idref)
      )
    }))

    let selectedProfile = null
    if (filterByProfileId) {
      selectedProfile = profileDefs.find(p => p.profileId === filterByProfileId)
      if (!selectedProfile) {
        throw new Error(`Profile "${filterByProfileId}" not found in benchmark. Available profiles: ${profileDefs.map(p => p.profileId).join(', ')}`)
      }
    }

    const rawGroups = bIn.Group.map(group => {
      const rules = group.Rule.map(rule => {
        const checks = rule.check ? rule.check.map(check => ({
          system: check.system,
          content: check['check-content']?.[0]?._ ||
                   check['check-content-ref']?.[0]?.name ||
                   check['check-content-ref']?.[0]?.href ||
                   null
        })) : []
        const fixes = rule.fixtext ? rule.fixtext.map(fix => ({
          fixref: fix.fixref,
          text: fix._
        })) : []
        const idents = rule.ident ? rule.ident.map(ident => ({
          ident: ident._,
          system: ident.system
        })) : []

        function parseRuleDescription(d) {
          const parsed = {}
          const propMap = {
            vulnDiscussion: 'VulnDiscussion',
            falsePositives: 'FalsePositives',
            falseNegatives: 'FalseNegatives',
            documentable: 'Documentable',
            mitigations: 'Mitigations',
            severityOverrideGuidance: 'SeverityOverrideGuidance',
            potentialImpacts: 'PotentialImpacts',
            thirdPartyTools: 'ThirdPartyTools',
            mitigationControl: 'MitigationControl',
            responsibility: 'Responsibility',
            iacontrols: 'IAControls'
          }
          for (const prop in propMap) {
            const re = new RegExp(`<${propMap[prop]}>([\\s\\S]*)</${propMap[prop]}>`)
            const result = re.exec(d)
            parsed[propMap[prop]] = result && result.length > 1 ? result[1] : null
          }
          if (parsed.Responsibility) {
            parsed.Responsibility = parsed.Responsibility.replace(/<\/Responsibility><Responsibility>/g, ', ')
          }
          return parsed
        }

        const rawDescription = rule.description?.[0]?._ || null
        const desc = rawDescription ? parseRuleDescription(rawDescription) : {}

        return {
          ruleId: rule.id,
          version: rule.version?.[0]?._ || null,
          title: rule.title?.[0]?._ || null,
          severity: rule.severity || null,
          weight: rule.weight || null,
          vulnDiscussion: desc.VulnDiscussion || null,
          falsePositives: desc.FalsePositives || null,
          falseNegatives: desc.FalseNegatives || null,
          documentable: desc.Documentable || null,
          mitigations: desc.Mitigations || null,
          severityOverrideGuidance: desc.SeverityOverrideGuidance || null,
          potentialImpacts: desc.PotentialImpacts || null,
          thirdPartyTools: desc.ThirdPartyTools || null,
          mitigationControl: desc.MitigationControl || null,
          responsibility: desc.Responsibility || null,
          iacontrols: desc.IAControls || null,
          checks,
          fixes,
          idents
        }
      })

      return {
        groupId: group.id,
        title: group.title?.[0]?._ || group.id,
        rules
      }
    })

    // Apply profile filter if specified
    const groups = selectedProfile
      ? rawGroups
          .map(group => {
            if (selectedProfile.selectedIds.has(group.groupId)) {
              return group
            }
            const filteredRules = group.rules.filter(r => selectedProfile.selectedIds.has(r.ruleId))
            return filteredRules.length > 0 ? { ...group, rules: filteredRules } : null
          })
          .filter(Boolean)
      : rawGroups

    const { release, benchmarkDate, benchmarkDate8601 } = parseReleaseInfo(bIn)
    const version = bIn.version?.[0]?._ || '1'

    // When filtering by profile, embed the profile short name in the release to keep revisions distinct
    const effectiveRelease = selectedProfile
      ? `${release}-${ssgProfileShortName(selectedProfile.profileId)}`
      : release

    const profiles = profileDefs.map(p => ({ profileId: p.profileId, title: p.title }))

    return {
      benchmarkId: bIn.id,
      title: bIn.title?.[0]?._,
      scap: isScap,
      profiles,
      revision: {
        revisionStr: `V${version}R${effectiveRelease}`,
        version,
        release: effectiveRelease,
        benchmarkDate,
        benchmarkDate8601,
        status: bIn.status?.[0]?._ || null,
        statusDate: bIn.status?.[0]?.date || null,
        description: bIn.description?.[0]?._ || null,
        groups
      }
    }
  }
  catch (e) {
    throw e
  }
}

module.exports.profilesFromXccdf = function (xccdfData) {
  try {
    const parser = makeXmlParser()
    const j = parser.parse(xccdfData.toString())
    const { bIn } = extractBenchmarkFromParsed(j)

    const profiles = (bIn.Profile || []).map(profile => ({
      profileId: profile.id,
      title: profile.title?.[0]?._ || profile.id,
      description: profile.description?.[0]?._ || null,
      selectedRuleCount: (profile.select || [])
        .filter(s => s.selected === 'true' || s.selected === true).length
    }))

    return {
      benchmarkId: bIn.id,
      title: bIn.title?.[0]?._ || null,
      profiles
    }
  }
  catch (e) {
    throw e
  }
}
