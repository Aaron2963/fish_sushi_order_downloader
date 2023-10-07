# Fish Sushi Order Downloader

## Description

This is a simple script to download the orders from the Fish Sushi website.

## Usage

After cloning the repository, run the following commands to install the dependencies:

```bash
npm install
```

To run the script:

```bash
npm run start
```

To build binaries for Windows 64-bit, run the following command:

```bash
npm run build
```

To change the source remote path and local directory path, edit the `config.json` file, and build the project again:

```json
{
  "host": "35.194.203.36",
  "port": 22,
  "username": "rsa-key-20200213",
  "privateKeyPath": "C:\\Users\\Administrator\\Desktop\\WinSCP Script\\rsa-key-20200213.ppk",
  "targets": [
    {
      "from": "/home/rsa-key-20200213/tastefresh/argo-sal",  // source remote path #1
      "to": "C:\\Users\\Administrator\\Documents\\網站ERP銷貨單資料夾勿動"  // local directory path #1
    },
    {
      "from": "/home/rsa-key-20200213/tastefresh/argo-odr",  // source remote path #2
      "to": "C:\\Users\\Administrator\\Documents\\網站ERP訂單資料夾勿動"  // local directory path #2
    }
  ]
}
```




