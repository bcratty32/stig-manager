"use strict";

const path = require('path')
const logger = require('../../../utils/logger')

module.exports = class MigrationHandler {
    constructor(upCommands = [], downCommands = []) {
        this._upCommands = upCommands;
        this._downCommands = downCommands;
    }

    async up(pool, filename) {
        let connection
        let migrationName = path.basename(filename, '.js')
        try {
          logger.writeInfo('mysql', 'migration', {status: 'start', direction: 'up', name: migrationName })
          connection = await pool.getConnection()
          // pooled connections can be returned with namedPlaceholders still enabled by a
          // previous holder, which breaks statements containing colons (e.g. procedure labels)
          connection.config.namedPlaceholders = false
          for (const statement of this._upCommands) {
            logger.writeInfo('mysql', 'migration', {status: 'running', name: migrationName, statement })
            await connection.query(statement)
          }
        }
        catch (e) {
          logger.writeError('mysql', 'migration', {status: 'error', name: migrationName, message: e.message })
          throw (e)
        }
        finally {
          await connection.release()
          logger.writeInfo('mysql', 'migration', {status: 'finish', name: migrationName })
        }
    }
      
    async down(pool, filename) {
        let connection
        let migrationName = path.basename(filename, '.js')
        try {
          logger.writeInfo('mysql', 'migration', {status: 'start', direction: 'down', name: migrationName })
          connection = await pool.getConnection()
          connection.config.namedPlaceholders = false
          for (const statement of this._downCommands) {
            logger.writeInfo('mysql', 'migration', {status: 'running', name: migrationName, statement })
            await connection.query(statement)
          }
          await connection.release()
        }
        catch (e) {
          logger.writeError('mysql', 'migration', {status: 'error', name: migrationName, message: e.message })
          throw (e)
        }
        finally {
          await connection.release()
          logger.writeInfo('mysql', 'migration', {status: 'finish', name: migrationName })
        }
    }
}
