const Client = require('ssh2-sftp-client')
const fs = require('fs')
const path = require('path')
const config = require('./config.json')
const sftp = new Client()
const logPath = path.join(process.cwd(), 'log', 'downloader.log')

class Logger {
  logLimit = 1000
  constructor(logPath) {
    this.path = logPath
    this.lineNum = 0
    try {
      // check if log file exists
      if (!fs.existsSync(path.dirname(logPath))) {
        fs.mkdirSync(path.dirname(logPath), { recursive: true })
      }
      if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '')
      }
      // count lines
      const log = fs.readFileSync(logPath, 'utf8')
      for (let i = 0; i < log.length; i++) {
        if (log[i] === '\n') {
          this.lineNum++
        }
      }
    } catch (error) {
      console.log(`failed to create log file: ${error}`)
      process.exit(1)
    }
  }

  append(message) {
    if (this.lineNum >= this.logLimit) {
      this.switchFile()
      this.lineNum = 0
    }
    const d = new Date()
    const time = d.toISOString().substring(0, 19)
    const log = `[${time}] ${message}\n`
    console.log(message)
    fs.appendFileSync(this.path, log)
    this.lineNum++
  }

  switchFile() {
    const dir = path.dirname(this.path)
    const filename = path.basename(this.path)
    const d = new Date().toISOString().substring(0, 16).replace(/[-:]/g, '')
    const newFilename = `${d}_${filename}`
    fs.renameSync(this.path, path.join(dir, newFilename))
    fs.writeFileSync(this.path, '')
  }
}

class Connection {
  constructor(sftpClient, config, logger) {
    this.config = config
    this.client = sftpClient
    this.logger = logger
    const d = new Date()
    this.time = `${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}` +
      `${d.getSeconds().toString().padStart(2, '0')}${d.getMilliseconds().toString().padStart(3, '0')}`
  }

  async connect() {
    try {
      await this.client.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        privateKey: fs.readFileSync(this.config.privateKeyPath)
      })
    } catch (error) {
      this.logger.append(`failed to connect: ${error}`)
      process.exit(1)
    }
    return
  }

  end() {
    this.client.end()
  }

  getTimedName(filename) {
    const filenameParts = filename.split('.')
    return `${filenameParts[0]}_${this.time}.${filenameParts[1]}`
  }

  async listFilenames(remotePath) {
    const files = await this.client.list(remotePath)
    return files.filter(file => file.type === '-').map(file => `${remotePath}/${file.name}`)
  }

  async download(context, filenames) {
    for (let i = 0; i < filenames.length; i++) {
      const remote = filenames[i],
        filename = remote.split('/').pop(),
        local = `${context}/${this.getTimedName(filename)}`
      try {
        await this.client.fastGet(remote, local)
        this.logger.append(`download ${local} from ${remote}`)
      } catch (error) {
        this.logger.append(`failed to download ${remote}: ${error}`)
      }
    }
    return;
  }

  async moveToOld(filenames) {
    if (filenames.length === 0) {
      return
    }
    const remotePath = filenames[0].split('/').slice(0, -1).join('/')
    const backupDir = `${remotePath}/old`
    // check if backup dir exists
    const hasDir = await this.client.exists(backupDir)
    if (!hasDir) {
      try {
        await this.client.mkdir(backupDir)
        this.logger.append(`create ${backupDir}`)
      } catch (error) {
        this.logger.append(`failed to create ${backupDir}: ${error}`)
      }
    }
    // move files to backup dir
    for (let i = 0; i < filenames.length; i++) {
      const filename = filenames[i].split('/').pop()
      const remote = `${remotePath}/${filename}`,
        backup = `${backupDir}/${this.getTimedName(filename)}`
      try {
        await this.client.rename(remote, backup)
        this.logger.append(`moved ${remote} to ${backup}`)
      } catch (err) {
        this.logger.append(`failed to move ${remote} to ${backup}: ${err}`)
      }
    }
  }
}

async function main() {
  const logger = new Logger(logPath)
  logger.append(`connecting to ${config.username}@${config.host}:${config.port}`)
  const conn = new Connection(sftp, config, logger)
  await conn.connect()
  for (let i = 0; i < config.targets.length; i++) {
    const target = config.targets[i]
    const files = await conn.listFilenames(target.from)
    logger.append(`found ${files.length} files from ${target.from}`)
    await conn.download(target.to, files)
    await conn.moveToOld(files)
  }
  conn.end()
  process.exit(0)
}

main()
