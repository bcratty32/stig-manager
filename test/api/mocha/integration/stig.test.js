
import { fileURLToPath } from 'url';
import {config } from '../testConfig.js'
import * as utils from '../utils/testUtils.js'
import reference from '../referenceData.js'
import path from 'path'
import fs from 'fs'
import { expect } from 'chai'

const user = {
  name: "stigmanadmin",
  grant: "Owner",
  userId: "1",
  token:
    "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJGSjg2R2NGM2pUYk5MT2NvNE52WmtVQ0lVbWZZQ3FvcXRPUWVNZmJoTmxFIn0.eyJleHAiOjE4NjQ2ODEwMzUsImlhdCI6MTY3MDU0MDIzNiwiYXV0aF90aW1lIjoxNjcwNTQwMjM1LCJqdGkiOiI0N2Y5YWE3ZC1iYWM0LTQwOTgtOWJlOC1hY2U3NTUxM2FhN2YiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjgwODAvYXV0aC9yZWFsbXMvc3RpZ21hbiIsImF1ZCI6WyJyZWFsbS1tYW5hZ2VtZW50IiwiYWNjb3VudCJdLCJzdWIiOiJiN2M3OGE2Mi1iODRmLTQ1NzgtYTk4My0yZWJjNjZmZDllZmUiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzdGlnLW1hbmFnZXIiLCJub25jZSI6IjMzNzhkYWZmLTA0MDQtNDNiMy1iNGFiLWVlMzFmZjczNDBhYyIsInNlc3Npb25fc3RhdGUiOiI4NzM2NWIzMy0yYzc2LTRiM2MtODQ4NS1mYmE1ZGJmZjRiOWYiLCJhY3IiOiIwIiwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbImNyZWF0ZV9jb2xsZWN0aW9uIiwiZGVmYXVsdC1yb2xlcy1zdGlnbWFuIiwiYWRtaW4iXX0sInJlc291cmNlX2FjY2VzcyI6eyJyZWFsbS1tYW5hZ2VtZW50Ijp7InJvbGVzIjpbInZpZXctdXNlcnMiLCJxdWVyeS1ncm91cHMiLCJxdWVyeS11c2VycyJdfSwiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJvcGVuaWQgc3RpZy1tYW5hZ2VyOmNvbGxlY3Rpb24gc3RpZy1tYW5hZ2VyOnN0aWc6cmVhZCBzdGlnLW1hbmFnZXI6dXNlcjpyZWFkIHN0aWctbWFuYWdlcjpvcCBzdGlnLW1hbmFnZXI6Y29sbGVjdGlvbjpyZWFkIHN0aWctbWFuYWdlcjpvcDpyZWFkIHN0aWctbWFuYWdlcjp1c2VyIHN0aWctbWFuYWdlciBzdGlnLW1hbmFnZXI6c3RpZyIsInNpZCI6Ijg3MzY1YjMzLTJjNzYtNGIzYy04NDg1LWZiYTVkYmZmNGI5ZiIsIm5hbWUiOiJTVElHTUFOIEFkbWluIiwicHJlZmVycmVkX3VzZXJuYW1lIjoic3RpZ21hbmFkbWluIiwiZ2l2ZW5fbmFtZSI6IlNUSUdNQU4iLCJmYW1pbHlfbmFtZSI6IkFkbWluIn0.a1XwJZw_FIzwMXKo-Dr-n11me5ut-SF9ni7ylX-7t7AVrH1eAqyBxX9DXaxFK0xs6YOhoPsh9NyW8UFVaYgtF68Ps6yzoiqFEeiRXkpN5ygICN3H3z6r-YwanLlEeaYR3P2EtHRcrBtCnt0VEKKbGPWOfeiNCVe3etlp9-NQo44",
}

describe(`POST - importBenchmark - /stigs`, () => {

  describe('Review Key Change', () => {

    before(async function () {
      await utils.loadAppData()
      await utils.uploadTestStig('U_VPN_SRG_V2R3_Manual-xccdf-reviewKeyChange.xml')
    })

    after(async function () {
      await utils.deleteStigByRevision("VPN_SRG_OTHER", "V2R3")
    })
    it('Import a new STIG - with new RuleID matching old content', async function () {
      
        const testStigfile = reference.reviewKeyChangeFile
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)
        const filePath = path.join(__dirname, `../../form-data-files/${testStigfile}`)
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        
        const blob = new Blob([fileContent], { type: 'text/xml' })
        const formData = new FormData()
        formData.append('importFile', blob, testStigfile)

        const res = await fetch(`${config.baseUrl}/stigs?elevate=true&clobber=true`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
          body: formData,
        })
        expect(res.status).to.eql(200)
    })
    it('Return the Review for an Asset and Rule - rule matches on stigId/checkContent', async function () {

        const res = await utils.executeRequest(`${config.baseUrl}/collections/${reference.testCollection.collectionId}/reviews/${reference.testAsset.assetId}/${'SV-106179r1_yyyy'}?projection=stigs&projection=rule`, 'GET', user.token)
        expect(res.status).to.eql(200)
        expect(res.body.stigs).to.not.be.null
        expect(res.body.rule).to.exist
        expect(res.body.ruleId).to.eql(reference.ruleId)
        expect(res.body.ruleIds).to.include("SV-106179r1_yyyy");
        expect(res.body.ruleIds).to.include(reference.ruleId)
        const regex = new RegExp(reference.reviewMatchString)
        expect(res.body.detail).to.match(regex)
    })
    it('PUT Review: stigs and rule projections Copy', async () => {

        const putBody = {
            "result": "pass",
            "detail": "test\nvisible to lvl1",
            "comment": "sure",
            "autoResult": false,
            "status": "submitted"
        }

        const res = await utils.executeRequest(`${config.baseUrl}/collections/${reference.testCollection.collectionId}/reviews/${reference.testAsset.assetId}/${'SV-106179r1_yyyy'}`, 'PUT', user.token, putBody)

        expect(res.status).to.eql(403)
    })    
    it('Set all properties of an Asset - assign new STIG', async function () {
        const res = await utils.executeRequest(`${config.baseUrl}/assets/${reference.testAsset.assetId}`, 'PUT', user.token, {
            "name": 'Collection_X_lvl1_asset-1',
            "collectionId": reference.testCollection.collectionId,
            "description": "test desc",
            "ip": "1.1.1.1",
            "noncomputing": true,
            "metadata": {
                "pocName": "poc2Put",
                "pocEmail": "pocEmailPut@email.com",
                "pocPhone": "12342",
                "reqRar": "true"
            },
            "stigs": [
                "VPN_SRG_TEST",
                "VPN_SRG_OTHER",
                "Windows_10_STIG_TEST",
                "RHEL_7_STIG_TEST"
            ]
        })
        expect(res.status).to.eql(200)
    })
    it('PUT Review: stigs and rule projections- put review to alternate ruleId', async function () {

        const reqData = {
            "result": "pass",
            "detail": "test\nvisible to lvl1",
            "comment": "sure",
            "autoResult": false,
            "status": "submitted"
        }
        const respData = await utils.executeRequest(`${config.baseUrl}/collections/${reference.testCollection.collectionId}/reviews/${reference.testAsset.assetId}/${'SV-106179r1_yyyy'}?projection=stigs&projection=rule`, 'PUT', user.token, reqData)

          const expectedReview = {
            access: "rw",
            assetId: "42",
            assetName: "Collection_X_lvl1_asset-1",
            assetLabelIds: [
                  "755b8a28-9a68-11ec-b1bc-0242ac110002",
                  "5130dc84-9a68-11ec-b1bc-0242ac110002"      
            ],
            assetLabels: reference.testAsset.fullLabels,
            ruleId: "SV-106179r1_yyyy",
            ruleIds: [
              "SV-106179r1_rule",
              "SV-106179r1_yyyy"
              ],
            result: reqData.result,
            resultEngine: null,
            detail: reqData.detail,
            autoResult: reqData.autoResult,
            comment: reqData.comment,
            userId: user.userId,
            username: user.name,
            ts: respData.body.ts,
            touchTs: respData.body.touchTs,
            status: {
                ts: respData.body.status.ts,
                text: null,
                user: {
                    userId: user.userId,
                    username: user.name
                },
                label: reqData.status
            },
            stigs: [        
                {
                      isDefault: true,
                      ruleCount: 2,
                      benchmarkId: "VPN_SRG_OTHER",
                      revisionStr: "V2R3",
                      benchmarkDate: "2021-07-19",
                      revisionPinned: false
                  }
              ],
            rule: {
              title: "This rule title has been replaced.",
              ruleId: "SV-106179r1_yyyy",
              version: "SRG-NET-000019-VPN-000040",
              severity: "medium"
            }
          }

        expect(respData.status).to.eql(200)
        expect(respData.body).to.deep.eql(expectedReview)
    })
    it('Return the Review for an Asset and Rule - rule matches on stigId/checkContent Copy', async function () {

        const res = await utils.executeRequest(`${config.baseUrl}/collections/${reference.testCollection.collectionId}/reviews/${reference.testAsset.assetId}/${'SV-106179r1_yyyy'}?projection=stigs&projection=rule`, 'GET', user.token)
        expect(res.status).to.eql(200)
        expect(res.body.stigs).to.not.be.null
        expect(res.body.rule).to.exist
        expect(res.body.ruleId).to.eql("SV-106179r1_yyyy")
        expect(res.body.ruleIds).to.include("SV-106179r1_yyyy");
        expect(res.body.ruleIds).to.include(reference.ruleId)
        const regex = new RegExp(reference.reviewMatchString)
        expect(res.body.detail).to.match(regex)
    })
  })

  describe('Checks for other revs, content matches', () => {

    before(async function () {
      await utils.loadAppData()
      await utils.deleteStigByRevision("VPN_SRG_OTHER", "V2R2")
    })

    after(async function () { 
      await utils.deleteStig("VPN_SRG_OTHER")
    })

    it('Import a new STIG - clobber', async () => {
                
      const testStigfile = 'U_VPN_SRG_V1R1_Manual-xccdf.xml'
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      const filePath = path.join(__dirname, `../../form-data-files/${testStigfile}`)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      
      const blob = new Blob([fileContent], { type: 'text/xml' })
      const formData = new FormData()
      formData.append('importFile', blob, testStigfile)

      const res = await fetch(`${config.baseUrl}/stigs?elevate=true&clobber=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      })
      let expectedRevData = 
      {
        "benchmarkId": "VPN_SRG_TEST",
        "revisionStr": "V1R1",
        "action": "replaced",
        marking: "U"
      }
      expect(res.status).to.eql(200)
      const data = await res.json()
      expect(data).to.deep.eql(expectedRevData)
    })
    it('Import another stig with check-system collision', async () => {
                  
      const testStigfile = "U_VPN_SRG-OTHER_V1R1_Manual-xccdf.xml"    
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      const filePath = path.join(__dirname, `../../form-data-files/${testStigfile}`)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      
      const blob = new Blob([fileContent], { type: 'text/xml' })
      const formData = new FormData()
      formData.append('importFile', blob, testStigfile)

      const res = await fetch(`${config.baseUrl}/stigs?elevate=true&clobber=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      })

      expect(res.status).to.eql(200)
      
      let expectedRevData = 
      {
        "benchmarkId": "VPN_SRG_OTHER",
        "revisionStr": "V2R2",
        "action": "inserted",
        "marking": "U"
    }
      const data = await res.json()
      expect(data).to.eql(expectedRevData)
    })
    it('Return rule data for the specified revision of a STIG - after import of "other" stig with checkId collision', async () => {

      const res = await utils.executeRequest(`${config.baseUrl}/stigs/${reference.benchmark}/revisions/${reference.testCollection.defaultRevision}/rules?projection=check`, 'GET', user.token)
      expect(res.status).to.eql(200)
      expect(res.body).to.be.an('array').of.length(reference.checklistLength)

      let title = "The VPN Gateway must ensure inbound and outbound traffic is configured with a security policy in compliance with information flow control policies."

      for(const rule of res.body){
        if(rule.ruleId === reference.ruleId){
          expect(rule.title).to.eql(title)
          if(rule.check.system === "C-95877r1_chk"){
            expect(rule.check.content).to.not.eql("This check content has been replaced!")
          }
        }
      }
    })
    it("Return rule data for the specified revision of a STIG - expect matches to other rev - requests V2R2", async () => {

      const res = await utils.executeRequest(`${config.baseUrl}/stigs/${'VPN_SRG_OTHER'}/revisions/V2R2/rules?projection=check`, 'GET', user.token)
      expect(res.status).to.eql(200)
      
      expect(res.body).to.be.an('array').of.length(2)
      let testRuleId = "SV-106179r1_xxxx"
      let title = "This rule title has been replaced."

      for(const rule of res.body){
        if(rule.ruleId === testRuleId){
          expect(rule.title).to.eql(title)
          if(rule.check.system === "C-95877r1_chk"){
            expect(rule.check.content).to.eql("This check content has been replaced!")
          }
        }
      }
    })
    it("Return rule data for the specified Rule in a revision of a STIG. request specific rule, expect one content match", async () => {

      const res = await utils.executeRequest(`${config.baseUrl}/stigs/${reference.benchmark}/revisions/${reference.testCollection.defaultRevision}/rules/${reference.ruleId}?projection=check`, 'GET', user.token)
      expect(res.status).to.eql(200)
      expect(res.body.ruleId).to.eql(reference.ruleId)
      expect(res.body.check.content).to.not.eql("This check content has been replaced!")
    })
  })

  describe('Replacement Tests', () => {

    before(async function () {
      try{
        await utils.deleteStigByRevision("VPN_SRG_TEST", "V1R0")
      }
      catch(e){
        console.log("No V1R0 to delete")
      }
    
      await utils.loadAppData()
    })

    it('Import and replace a STIG revision', async function () {
      
      const testStigfile = 'U_VPN_SRG_V1R1_Manual-xccdf-replace.xml'
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      const filePath = path.join(__dirname, `../../form-data-files/${testStigfile}`)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      
      const blob = new Blob([fileContent], { type: 'text/xml' })
      const formData = new FormData()
      formData.append('importFile', blob, testStigfile)

      const res = await fetch(`${config.baseUrl}/stigs?elevate=true&clobber=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      })

      let expectedRevData = 
      {
          "benchmarkId": "VPN_SRG_TEST",
          "revisionStr": "V1R1",
          "action": "replaced",
          "marking": "U"
      }
      expect(res.status).to.eql(200)
      const data = await res.json() 
      expect(data).to.deep.eql(expectedRevData)
    })
    it('Return a list of revisions for the specified STIG - check for updated revision', async function () {
      const res = await utils.executeRequest(`${config.baseUrl}/stigs/${reference.benchmark}/revisions`, 'GET', user.token)
      expect(res.status).to.eql(200)
      expect(res.body).to.be.an('array').of.length(1)
      for(const rev of res.body){
        expect(rev.ruleCount).to.eql(2)
      }
    })
    it('Return rule data for the specified revision of a STIG after update', async function () {
      const res = await utils.executeRequest(`${config.baseUrl}/stigs/${reference.benchmark}/revisions/${reference.testCollection.defaultRevision}/rules?projection=detail&projection=ccis&projection=check&projection=fix`, 'GET', user.token)
      expect(res.status).to.eql(200)
      let title = "This rule title has been replaced."
      expect(res.body).to.be.an('array').of.length(2)
      for(const rule of res.body){
        if (rule.ruleId === reference.ruleId){
              expect(rule.title).to.eql(title)
        }
      }
    })
    it('Return rule data for the specified Rule in a revision of a STIG after update', async function () {

      const res = await utils.executeRequest(`${config.baseUrl}/stigs/${reference.benchmark}/revisions/${reference.testCollection.defaultRevision}/rules/${reference.ruleId}?projection=detail&projection=ccis&projection=check&projection=fix`, 'GET', user.token)
        expect(res.status).to.eql(200)
        let title = "This rule title has been replaced."
        expect(res.body.title).to.eql(title)
    })
  })
})

describe('SSG benchmark import - POST /stigs', () => {

  const ssgBenchmarkId = 'xccdf_org.ssgproject.content_benchmark_RHEL-9'
  const ssgDsBenchmarkId = 'xccdf_org.ssgproject.content_benchmark_RHEL-9-DS'

  async function uploadSsgFile(filename, queryParams = '') {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const filePath = path.join(__dirname, `../../form-data-files/${filename}`)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const blob = new Blob([fileContent], { type: 'text/xml' })
    const formData = new FormData()
    formData.append('importFile', blob, filename)
    return fetch(`${config.baseUrl}/stigs?elevate=true&clobber=true${queryParams}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: formData,
    })
  }

  async function uploadForProfiles(filename) {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const filePath = path.join(__dirname, `../../form-data-files/${filename}`)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const blob = new Blob([fileContent], { type: 'text/xml' })
    const formData = new FormData()
    formData.append('importFile', blob, filename)
    return fetch(`${config.baseUrl}/stigs/benchmark/profiles?elevate=true`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: formData,
    })
  }

  describe('SSG standalone XCCDF - import all rules', () => {

    after(async () => {
      await utils.deleteStig(ssgBenchmarkId)
    })

    it('should import SSG XCCDF benchmark successfully', async () => {
      const res = await uploadSsgFile('SSG_RHEL9_test-xccdf.xml')
      expect(res.status).to.eql(200)
      const data = await res.json()
      expect(data.benchmarkId).to.eql(ssgBenchmarkId)
      expect(data.revisionStr).to.eql('V0.1.71R1')
      expect(data.action).to.be.oneOf(['inserted', 'replaced'])
    })

    it('should return imported SSG benchmark with correct rule count', async () => {
      const res = await utils.executeRequest(
        `${config.baseUrl}/stigs/${ssgBenchmarkId}/revisions/V0.1.71R1/rules`,
        'GET', user.token
      )
      expect(res.status).to.eql(200)
      expect(res.body).to.be.an('array').of.length(2)
    })

    it('should have CCI mapped for SSG rules (https ident system)', async () => {
      const res = await utils.executeRequest(
        `${config.baseUrl}/stigs/${ssgBenchmarkId}/revisions/V0.1.71R1/rules?projection=ccis`,
        'GET', user.token
      )
      expect(res.status).to.eql(200)
      const ruleWithCci = res.body.find(r => r.ccis && r.ccis.length > 0)
      expect(ruleWithCci, 'at least one rule should have CCI mappings').to.exist
    })
  })

  describe('SSG XCCDF - import with profile filter (STIG profile)', () => {

    const profileFilteredRevStr = 'V0.1.71R1-stig'

    after(async () => {
      await utils.deleteStig(ssgBenchmarkId)
    })

    it('should import SSG XCCDF benchmark filtered to STIG profile', async () => {
      const profileId = 'xccdf_org.ssgproject.content_profile_stig'
      const res = await uploadSsgFile('SSG_RHEL9_test-xccdf.xml', `&profileId=${encodeURIComponent(profileId)}`)
      expect(res.status).to.eql(200)
      const data = await res.json()
      expect(data.benchmarkId).to.eql(ssgBenchmarkId)
      expect(data.revisionStr).to.eql(profileFilteredRevStr)
    })

    it('should have only STIG-profile-selected rules (2 of 2)', async () => {
      const res = await utils.executeRequest(
        `${config.baseUrl}/stigs/${ssgBenchmarkId}/revisions/${profileFilteredRevStr}/rules`,
        'GET', user.token
      )
      expect(res.status).to.eql(200)
      expect(res.body).to.be.an('array').of.length(2)
    })
  })

  describe('SSG XCCDF - import with profile filter (CIS L1 profile)', () => {

    const profileFilteredRevStr = 'V0.1.71R1-cis_l1_server'

    after(async () => {
      await utils.deleteStig(ssgBenchmarkId)
    })

    it('should import SSG XCCDF benchmark filtered to CIS L1 profile', async () => {
      const profileId = 'xccdf_org.ssgproject.content_profile_cis_l1_server'
      const res = await uploadSsgFile('SSG_RHEL9_test-xccdf.xml', `&profileId=${encodeURIComponent(profileId)}`)
      expect(res.status).to.eql(200)
      const data = await res.json()
      expect(data.benchmarkId).to.eql(ssgBenchmarkId)
      expect(data.revisionStr).to.eql(profileFilteredRevStr)
    })

    it('should have only CIS-L1-profile-selected rules (1 of 2)', async () => {
      const res = await utils.executeRequest(
        `${config.baseUrl}/stigs/${ssgBenchmarkId}/revisions/${profileFilteredRevStr}/rules`,
        'GET', user.token
      )
      expect(res.status).to.eql(200)
      expect(res.body).to.be.an('array').of.length(1)
    })
  })

  describe('SSG XCCDF - profile listing endpoint', () => {

    it('should return profiles from SSG XCCDF file', async () => {
      const res = await uploadForProfiles('SSG_RHEL9_test-xccdf.xml')
      expect(res.status).to.eql(200)
      const data = await res.json()
      expect(data.benchmarkId).to.eql(ssgBenchmarkId)
      expect(data.profiles).to.be.an('array').of.length(2)
      const profileIds = data.profiles.map(p => p.profileId)
      expect(profileIds).to.include('xccdf_org.ssgproject.content_profile_stig')
      expect(profileIds).to.include('xccdf_org.ssgproject.content_profile_cis_l1_server')
    })

    it('should return profiles from SSG SCAP data stream file', async () => {
      const res = await uploadForProfiles('SSG_RHEL9_test-ds.xml')
      expect(res.status).to.eql(200)
      const data = await res.json()
      expect(data.benchmarkId).to.eql(ssgDsBenchmarkId)
      expect(data.profiles).to.be.an('array').of.length(1)
      expect(data.profiles[0].profileId).to.eql('xccdf_org.ssgproject.content_profile_stig')
      expect(data.profiles[0].selectedRuleCount).to.eql(2)
    })
  })

  describe('SSG SCAP data stream - import', () => {

    after(async () => {
      await utils.deleteStig(ssgDsBenchmarkId)
    })

    it('should import SCAP data stream (previously rejected) successfully', async () => {
      const res = await uploadSsgFile('SSG_RHEL9_test-ds.xml')
      expect(res.status).to.eql(200)
      const data = await res.json()
      expect(data.benchmarkId).to.eql(ssgDsBenchmarkId)
      expect(data.revisionStr).to.eql('V0.1.71R1')
      expect(data.action).to.be.oneOf(['inserted', 'replaced'])
    })

    it('should return correct rule count from SCAP data stream', async () => {
      const res = await utils.executeRequest(
        `${config.baseUrl}/stigs/${ssgDsBenchmarkId}/revisions/V0.1.71R1/rules`,
        'GET', user.token
      )
      expect(res.status).to.eql(200)
      expect(res.body).to.be.an('array').of.length(2)
    })
  })

  describe('SSG - invalid profileId returns 400', () => {

    it('should reject unknown profileId with 400', async () => {
      const res = await uploadSsgFile('SSG_RHEL9_test-xccdf.xml', '&profileId=nonexistent_profile')
      expect(res.status).to.eql(400)
    })
  })
})