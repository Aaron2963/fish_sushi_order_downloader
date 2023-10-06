const Client = require('ssh2-sftp-client')
const fs = require('fs')
const config = require('./config.json')
const sftp = new Client()

class Connection {
  constructor(sftpClient, config) {
    this.config = config
    this.client = sftpClient
    const d = new Date()
    this.time = `${d.getHours().toString().padStart(2, '0')}${d.getMinutes().toString().padStart(2, '0')}` + 
      `${d.getSeconds().toString().padStart(2, '0')}${d.getMilliseconds().toString().padStart(3, '0')}`
  }

  async connect() {
    await this.client.connect({
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      privateKey: fs.readFileSync(this.config.privateKeyPath)
    })
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
      console.log(`downloading ${local} from ${remote}...`)
      await this.client.fastGet(remote, local)
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
        console.log(`creating ${backupDir}...`)
        await this.client.mkdir(backupDir)
      } catch (error) {
        console.log(error)
      }
    }
    // move files to backup dir
    for (let i = 0; i < filenames.length; i++) {
      const filename = filenames[i].split('/').pop()
      const remote = `${remotePath}/${filename}`,
        backup = `${backupDir}/${this.getTimedName(filename)}`
      try {
        console.log(`moving ${remote} to ${backup}...`)
        await this.client.rename(remote, backup)
      } catch (err) {
        console.log(err)
      }
    }
  }


}

async function main() {
  console.log(`connecting to ${config.username}@${config.host}:${config.port}`)
  const conn = new Connection(sftp, config)
  await conn.connect()
  for (let i = 0; i < config.targets.length; i++) {
    const target = config.targets[i]
    const files = await conn.listFilenames(target.from)
    console.log(`found ${files.length} files from ${target.from}`)
    await conn.download(target.to, files)
    await conn.moveToOld(files)
  }
  conn.end()
}

main()
