import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import { S3Client, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import Store from 'electron-store'
const fs = require('fs')
const mime = require('mime-types')
const { dialog } = require('electron')
const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { Upload } = require('@aws-sdk/lib-storage')

const store = new Store()
let mainWindow

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 670,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' || process.platform === 'win32' ? { icon: join(__dirname, '../../resources/icon.png') } : {}),

        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// --- IPC Handlers for R2 ---

// Helper to get S3 Client
const getS3Client = (credentials) => {
    if (!credentials) return null

    // Sanitize inputs
    let endpoint = credentials.endpoint.trim()
    const accessKeyId = credentials.accessKeyId.trim()
    const secretAccessKey = credentials.secretAccessKey.trim()

    if (!endpoint.startsWith('http')) {
        endpoint = `https://${endpoint}`
    }
    // Remove trailing slash if present
    endpoint = endpoint.replace(/\/$/, '')

    console.log(`Connecting to R2 Endpoint: ${endpoint}`)

    return new S3Client({
        region: 'auto',
        endpoint: endpoint,
        forcePathStyle: true, // Required for R2
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        }
    })
}

ipcMain.handle('r2:listBuckets', async (_, credentials) => {
    try {
        const s3 = getS3Client(credentials)
        const result = await s3.send(new ListBucketsCommand({}))
        console.log('Successfully listed buckets')
        return { success: true, buckets: result.Buckets }
    } catch (error) {
        console.error('R2 listBuckets Error:', error)
        return { success: false, error: error.message }
    }
})



ipcMain.handle('r2:listFiles', async (_, { credentials, bucketName, prefix = '' }) => {
    try {
        const s3 = getS3Client(credentials)
        const params = {
            Bucket: bucketName,
            Delimiter: '/',
            Prefix: prefix
        }
        const result = await s3.send(new ListObjectsV2Command(params))

        // Filter out the folder itself if it appears in Contents
        const files = (result.Contents || []).filter(f => f.Key !== prefix)
        const folders = (result.CommonPrefixes || []).map(p => p.Prefix)

        return { success: true, files, folders }
    } catch (error) {
        return { success: false, error: error.message }
    }
})

ipcMain.handle('r2:uploadFile', async (_, { credentials, bucketName, filePath, prefix = '' }) => {
    try {
        const s3 = getS3Client(credentials)
        const fileName = path.basename(filePath)
        const key = prefix ? `${prefix}${fileName}` : fileName
        const fileStream = fs.createReadStream(filePath)
        const contentType = mime.lookup(filePath) || 'application/octet-stream'

        const upload = new Upload({
            client: s3,
            params: {
                Bucket: bucketName,
                Key: key,
                Body: fileStream,
                ContentType: contentType
            }
        })

        await upload.done()
        return { success: true }
    } catch (error) {
        console.error('Upload Error:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('r2:deleteFile', async (_, { credentials, bucketName, key }) => {
    try {
        const s3 = getS3Client(credentials)
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key
        }))
        return { success: true }
    } catch (error) {
        console.error('Delete Error:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('r2:downloadFile', async (_, { credentials, bucketName, key }) => {
    try {
        const s3 = getS3Client(credentials)

        // Ask user where to save
        const { canceled, filePath } = await dialog.showSaveDialog({
            defaultPath: key,
            title: 'Save File'
        })

        if (canceled || !filePath) {
            return { success: false, canceled: true }
        }

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        })

        const response = await s3.send(command)

        // Stream to file
        const writeStream = fs.createWriteStream(filePath)

        // response.Body is a readable stream in Node.js env
        response.Body.pipe(writeStream)

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve)
            writeStream.on('error', reject)
        })

        return { success: true }
    } catch (error) {
        console.error('Download Error:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
        return null
    }
    return result.filePaths[0]
})

// --- Auth Handlers ---

ipcMain.handle('auth:saveCredentials', async (_, credentials) => {
    try {
        store.set('credentials', credentials)
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
})

ipcMain.handle('auth:getCredentials', async () => {
    try {
        const credentials = store.get('credentials')
        return { success: true, credentials }
    } catch (error) {
        return { success: false, error: error.message }
    }
})

ipcMain.handle('auth:deleteCredentials', async () => {
    try {
        store.delete('credentials')
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
})
