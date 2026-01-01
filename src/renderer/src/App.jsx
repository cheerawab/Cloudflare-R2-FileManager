import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './components/ui/card'
import { Input } from './components/ui/input'
import { Button } from './components/ui/button'
import { Label } from './components/ui/label'
import {
    Upload, Download, Trash, File as FileIcon,
    LogOut, Loader2, Database,
    Search, Settings, HardDrive, Info,
    ArrowUp, ArrowDown, ArrowUpDown, Folder,
    Sun, Moon, Globe, Check, ChevronDown, ChevronUp
} from 'lucide-react'

// Import all locale files using Vite's glob import
const modules = import.meta.glob('./lang/*.json', { eager: true })
const locales = Object.keys(modules).reduce((acc, path) => {
    const lang = path.match(/\.\/lang\/(.*)\.json/)[1]
    acc[lang] = modules[path].default || modules[path]
    return acc
}, {})

function App() {
    const [view, setView] = useState('login')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [credentials, setCredentials] = useState({
        endpoint: '',
        accessKeyId: '',
        secretAccessKey: '',
        bucketName: ''
    })

    const [buckets, setBuckets] = useState([])
    const [files, setFiles] = useState([])
    const [folders, setFolders] = useState([])
    const [currentBucket, setCurrentBucket] = useState(null)
    const [currentPath, setCurrentPath] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const [sortConfig, setSortConfig] = useState({ key: 'LastModified', direction: 'desc' })
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
    const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en')

    // Translation helper
    const t = (key) => {
        const langData = locales[language] || locales['en']
        return langData[key] || key
    }

    const availableLanguages = Object.keys(locales)

    useEffect(() => {
        localStorage.setItem('language', language)
    }, [language])

    useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(theme)
        localStorage.setItem('theme', theme)
    }, [theme])

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark')
    }

    useEffect(() => {
        const loadCredentials = async () => {
            const result = await window.api.getCredentials()
            if (result.success && result.credentials) {
                setCredentials(result.credentials)
                setRememberMe(true)
            }
        }
        loadCredentials()
    }, [])

    const validateCredentials = (id, secret) => {
        const hexRegex = /^[0-9a-fA-F]+$/
        if (id.length !== 32 || !hexRegex.test(id)) {
            if (id.includes('_') || id.includes('-') || id.length > 32) {
                return "Invalid Access Key ID. It looks like a Cloudflare API Token. Please use the S3 Access Key ID."
            }
            return "Invalid Access Key ID. Must be 32-char hex string."
        }
        if (secret.length !== 64 || !hexRegex.test(secret)) {
            return "Invalid Secret Access Key. Must be 64-char hex string."
        }
        return null
    }

    const loadFiles = async (bucket, prefix = '') => {
        setLoading(true)
        setError(null)
        try {
            const result = await window.api.listFiles({ credentials, bucketName: bucket, prefix })
            if (result.success) {
                setFiles(result.files)
                setFolders(result.folders)
                setCurrentBucket(bucket)
                setCurrentPath(prefix)
                setView('files')
            } else {
                setError(result.error)
            }
        } catch (err) {
            setError(`Failed to list files in ${bucket}`)
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const accessKeyId = credentials.accessKeyId.trim()
        const secretAccessKey = credentials.secretAccessKey.trim()

        const validationError = validateCredentials(accessKeyId, secretAccessKey)
        if (validationError) {
            setError(validationError)
            setLoading(false)
            return
        }

        const bucketToAccess = credentials.bucketName ? credentials.bucketName.trim() : null

        try {
            if (rememberMe) {
                await window.api.saveCredentials(credentials)
            } else {
                await window.api.deleteCredentials()
            }

            if (bucketToAccess) {
                await loadFiles(bucketToAccess)
            } else {
                const result = await window.api.listBuckets(credentials)
                if (result.success) {
                    setBuckets(result.buckets)
                    setView('buckets')
                } else {
                    setError(result.error)
                }
            }
        } catch (err) {
            setError('Failed to connect to R2')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value })
    }

    const handleBucketClick = async (bucketName) => {
        await loadFiles(bucketName)
    }

    const handleFolderClick = async (folderPrefix) => {
        await loadFiles(currentBucket, folderPrefix)
    }

    const handleBreadcrumbClick = async (index) => {
        if (index === -1) {
            await loadFiles(currentBucket, '')
            return
        }
        const parts = currentPath.split('/').filter(p => p)
        const newPath = parts.slice(0, index + 1).join('/') + '/'
        await loadFiles(currentBucket, newPath)
    }

    const handleLogout = () => {
        setView('login')
        setFiles([])
        setFolders([])
        setCurrentBucket(null)
        setCurrentPath('')
        setBuckets([])
    }

    const handleBackToBuckets = () => {
        setView('buckets')
        setFiles([])
        setFolders([])
        setCurrentBucket(null)
        setCurrentPath('')
    }

    const handleUpload = async () => {
        setError(null)
        try {
            const filePath = await window.api.openFileDialog()
            if (!filePath) return
            setLoading(true)
            const result = await window.api.uploadFile({
                credentials,
                bucketName: currentBucket,
                filePath,
                prefix: currentPath
            })
            if (result.success) {
                await loadFiles(currentBucket, currentPath)
            } else {
                setError(`Upload failed: ${result.error}`)
            }
        } catch (err) { setError('Upload failed') } finally { setLoading(false) }
    }

    const handleDelete = async (key) => {
        if (!confirm(`Delete "${key}"?`)) return
        setLoading(true)
        setError(null)
        try {
            const result = await window.api.deleteFile({ credentials, bucketName: currentBucket, key })
            if (result.success) {
                await loadFiles(currentBucket, currentPath)
            } else {
                setError(`Delete failed: ${result.error}`)
            }
        } catch (err) { setError('Delete failed') } finally { setLoading(false) }
    }

    const handleDownload = async (key) => {
        setLoading(true)
        setError(null)
        try {
            const result = await window.api.downloadFile({ credentials, bucketName: currentBucket, key })
            if (!result.success && !result.canceled) setError(`Download failed: ${result.error}`)
        } catch (err) { setError('Download failed') } finally { setLoading(false) }
    }

    const handleSort = (key) => {
        let direction = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const filteredFiles = files.filter(f => f.Key.toLowerCase().includes(searchTerm.toLowerCase()))

    const sortedFiles = [...filteredFiles].sort((a, b) => {
        if (sortConfig.key === 'Key') {
            return sortConfig.direction === 'asc'
                ? a.Key.localeCompare(b.Key)
                : b.Key.localeCompare(a.Key)
        }
        if (sortConfig.key === 'Size') {
            return sortConfig.direction === 'asc'
                ? a.Size - b.Size
                : b.Size - a.Size
        }
        if (sortConfig.key === 'LastModified') {
            return sortConfig.direction === 'asc'
                ? new Date(a.LastModified) - new Date(b.LastModified)
                : new Date(b.LastModified) - new Date(a.LastModified)
        }
        return 0
    })

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="h-3 w-3 ml-2 opacity-50" />
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="h-3 w-3 ml-2 text-blue-400" />
            : <ArrowDown className="h-3 w-3 ml-2 text-blue-400" />
    }

    // --- Layout Components ---

    const Sidebar = () => (
        <div className="w-64 glass-panel border-r border-white/5 flex flex-col h-screen fixed left-0 top-0 z-50">
            <div className="p-6 flex items-center space-x-3 border-b border-white/5">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Database className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-lg tracking-tight">{t('appTitle')}</span>
            </div>

            <div className="flex-1 p-4 space-y-2">
                <Button
                    variant={view === 'buckets' ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={handleBackToBuckets}
                >
                    <HardDrive className="mr-2 h-4 w-4" /> {t('buckets')}
                </Button>
                {/* Placeholder for future features */}
                <Button
                    variant={view === 'settings' ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setView('settings')}
                >
                    <Settings className="mr-2 h-4 w-4" /> {t('settings')}
                </Button>
            </div>

            <div className="p-4 border-t border-white/5">
                <div className="bg-white/5 rounded-lg p-3 mb-3">
                    <div className="text-xs text-muted-foreground mb-1">{t('connectedAs')}</div>
                    <div className="text-xs font-mono truncate opacity-70" title={credentials.accessKeyId}>
                        {credentials.accessKeyId.substring(0, 16)}...
                    </div>
                </div>
                <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> {t('disconnect')}
                </Button>
            </div>
        </div>
    )

    // --- Views ---

    if (view === 'login') {
        return (
            <div className="flex items-center justify-center min-h-screen p-4 relative overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

                <Card className="w-full max-w-md glass-panel border-0 shadow-2xl">
                    <CardHeader className="space-y-1 text-center pb-8">
                        <div className="mx-auto h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                            <Database className="h-6 w-6 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-bold">{t('welcomeBack')}</CardTitle>
                        <CardDescription>{t('welcomeDesc')}</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleLogin}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="endpoint">{t('endpointUrl')}</Label>
                                <Input
                                    className="bg-black/20 border-white/10 focus:border-blue-500/50 transition-colors"
                                    id="endpoint" name="endpoint" required
                                    placeholder={t('phEndpoint')}
                                    value={credentials.endpoint} onChange={handleInputChange}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="accessKeyId">{t('accessKeyId')}</Label>
                                    <Input
                                        className="bg-black/20 border-white/10 focus:border-blue-500/50"
                                        type="password" id="accessKeyId" name="accessKeyId" required
                                        value={credentials.accessKeyId} onChange={handleInputChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="secretAccessKey">{t('secretKey')}</Label>
                                    <Input
                                        className="bg-black/20 border-white/10 focus:border-blue-500/50"
                                        type="password" id="secretAccessKey" name="secretAccessKey" required
                                        value={credentials.secretAccessKey} onChange={handleInputChange}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bucketName">{t('bucketName')} <span className="text-muted-foreground text-xs font-normal">{t('bucketNameOptional')}</span></Label>
                                <Input
                                    className="bg-black/20 border-white/10 focus:border-blue-500/50"
                                    id="bucketName" name="bucketName"
                                    placeholder={t('phBucket')}
                                    value={credentials.bucketName} onChange={handleInputChange}
                                />
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox" id="rememberMe"
                                    className="h-4 w-4 rounded border-white/20 bg-black/20 text-blue-500 focus:ring-blue-500/20"
                                    checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <Label htmlFor="rememberMe" className="cursor-pointer text-sm">{t('rememberMe')}</Label>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in slide-in-from-top-1">
                                    <p className="font-medium">{t('connectionFailed')}</p>
                                    <p className="text-xs opacity-80 mt-1">{error}</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {loading ? t('connecting') : t('connectToR2')}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        )
    }

    // --- Dashboard Layout ---

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <Sidebar />

            <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen relative">
                {/* Top Bar */}
                <div className="mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
                    {/* Row 1: Breadcrumbs (Full Width) */}
                    <div className="flex items-center space-x-1 mb-4 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide mask-linear-fade">
                        <div
                            onClick={handleBackToBuckets}
                            className="px-3 py-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white cursor-pointer transition-all text-xs font-medium border border-transparent hover:border-white/10 flex-shrink-0"
                        >
                            {t('buckets')}
                        </div>

                        {view === 'files' && (
                            <>
                                <ArrowDown className="h-3 w-3 -rotate-90 text-muted-foreground/30 flex-shrink-0" />
                                <div
                                    onClick={() => handleBreadcrumbClick(-1)}
                                    className={`px-3 py-1 rounded-full transition-all text-xs font-medium flex-shrink-0 cursor-pointer border ${!currentPath ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'hover:bg-white/10 text-muted-foreground hover:text-white border-transparent hover:border-white/10'}`}
                                >
                                    {currentBucket}
                                </div>
                            </>
                        )}

                        {(() => {
                            const parts = currentPath.split('/').filter(p => p)
                            const visibleCount = 3
                            const shouldTruncate = parts.length > visibleCount
                            const startIndex = shouldTruncate ? parts.length - visibleCount : 0
                            const visibleParts = parts.slice(startIndex)

                            return (
                                <>
                                    {shouldTruncate && (
                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                            <ArrowDown className="h-3 w-3 -rotate-90 text-muted-foreground/30" />
                                            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">../</div>
                                        </div>
                                    )}
                                    {visibleParts.map((part, i) => {
                                        const originalIndex = startIndex + i
                                        return (
                                            <div key={originalIndex} className="flex items-center space-x-1 flex-shrink-0">
                                                <ArrowDown className="h-3 w-3 -rotate-90 text-muted-foreground/30" />
                                                <div
                                                    onClick={() => handleBreadcrumbClick(originalIndex)}
                                                    className={`px-3 py-1 rounded-full transition-all text-xs font-medium cursor-pointer border ${originalIndex === parts.length - 1 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'hover:bg-white/10 text-muted-foreground hover:text-white border-transparent hover:border-white/10'}`}
                                                >
                                                    {part}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </>
                            )
                        })()}
                    </div>

                    {/* Row 2: Title and Actions */}
                    <div className="flex items-center justify-between gap-4">
                        <h1 className="text-2xl font-bold tracking-tight truncate flex-1 min-w-0 mr-4" title={view === 'buckets' ? t('buckets') : (currentPath.split('/').filter(p => p).pop() || currentBucket)}>
                            {view === 'buckets' ? t('buckets') : (currentPath.split('/').filter(p => p).pop() || currentBucket)}
                        </h1>

                        {view === 'files' && (
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9 w-64 bg-black/20 border-white/10 rounded-full"
                                        placeholder={t('searchFiles')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleUpload} disabled={loading} className="bg-blue-600 hover:bg-blue-500 rounded-full px-6">
                                    <Upload className="mr-2 h-4 w-4" /> {t('upload')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {error && <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}

                {loading && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                    </div>
                )}

                {/* Content Area */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {view === 'buckets' && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {buckets.length === 0 && !loading && (
                                <div className="col-span-full text-center py-20 text-muted-foreground">
                                    {t('noBucketsFound')}
                                </div>
                            )}
                            {buckets.map((bucket) => (
                                <div
                                    key={bucket.Name}
                                    onClick={() => handleBucketClick(bucket.Name)}
                                    className="glass-card group p-6 rounded-xl cursor-pointer hover:-translate-y-1 transition-all"
                                >
                                    <div className="h-12 w-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                                        <HardDrive className="h-6 w-6 text-blue-500" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-1 group-hover:text-blue-400 transition-colors">{bucket.Name}</h3>
                                    <p className="text-xs text-muted-foreground">{t('created')} {new Date(bucket.CreationDate).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {view === 'files' && (
                        <div className="glass-panel rounded-xl overflow-hidden min-h-[500px]">
                            <div className="grid grid-cols-12 px-6 py-4 border-b border-white/5 text-sm font-medium text-muted-foreground bg-white/5">
                                <div
                                    className="col-span-6 cursor-pointer hover:text-foreground flex items-center transition-colors select-none"
                                    onClick={() => handleSort('Key')}
                                >
                                    {t('name')} <SortIcon columnKey="Key" />
                                </div>
                                <div
                                    className="col-span-2 cursor-pointer hover:text-foreground flex items-center transition-colors select-none"
                                    onClick={() => handleSort('Size')}
                                >
                                    {t('size')} <SortIcon columnKey="Size" />
                                </div>
                                <div
                                    className="col-span-3 cursor-pointer hover:text-foreground flex items-center transition-colors select-none"
                                    onClick={() => handleSort('LastModified')}
                                >
                                    {t('lastModified')} <SortIcon columnKey="LastModified" />
                                </div>
                                <div className="col-span-1 text-right">{t('actions')}</div>
                            </div>
                            <div className="divide-y divide-white/5">
                                {currentPath && (
                                    <div
                                        className="grid grid-cols-12 items-center px-6 py-3 hover:bg-white/5 transition-colors text-sm cursor-pointer border-l-2 border-transparent hover:border-blue-500"
                                        onClick={() => {
                                            const parts = currentPath.split('/').filter(p => p)
                                            parts.pop() // Remove current folder
                                            const parentPath = parts.length > 0 ? parts.join('/') + '/' : ''
                                            loadFiles(currentBucket, parentPath)
                                        }}
                                    >
                                        <div className="col-span-12 flex items-center space-x-2 text-muted-foreground">
                                            <Folder className="h-4 w-4" />
                                            <span>..</span>
                                        </div>
                                    </div>
                                )}

                                {folders.map((folder) => (
                                    <div
                                        key={folder}
                                        onClick={() => handleFolderClick(folder)}
                                        className="grid grid-cols-12 items-center px-6 py-3 hover:bg-white/5 transition-colors text-sm cursor-pointer group"
                                    >
                                        <div className="col-span-6 flex items-center pr-4">
                                            <div className="mr-3 h-8 w-8 min-w-[2rem] rounded bg-yellow-500/10 flex items-center justify-center">
                                                <Folder className="h-4 w-4 text-yellow-500" />
                                            </div>
                                            <span className="truncate font-medium text-foreground/90 group-hover:text-blue-400 transition-colors">
                                                {folder.replace(currentPath, '').replace('/', '')}
                                            </span>
                                        </div>
                                        <div className="col-span-6 text-muted-foreground text-xs italic">Folder</div>
                                    </div>
                                ))}

                                {sortedFiles.length === 0 && folders.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground">
                                        {searchTerm ? t('noFilesFound') : t('folderEmpty')}
                                    </div>
                                ) : (
                                    sortedFiles.map((file) => (
                                        <div key={file.Key} className="grid grid-cols-12 items-center px-6 py-3 hover:bg-white/5 transition-colors text-sm group">
                                            <div className="col-span-6 flex items-center pr-4 overflow-hidden">
                                                <div className="mr-3 h-8 w-8 min-w-[2rem] rounded bg-white/5 flex items-center justify-center">
                                                    <FileIcon className="h-4 w-4 opacity-50" />
                                                </div>
                                                <span className="truncate font-medium text-foreground/90 group-hover:text-blue-400 transition-colors" title={file.Key}>
                                                    {file.Key.replace(currentPath, '')}
                                                </span>
                                            </div>
                                            <div className="col-span-2 text-muted-foreground font-mono text-xs">{(file.Size / 1024).toFixed(2)} KB</div>
                                            <div className="col-span-3 text-muted-foreground text-xs">{new Date(file.LastModified).toLocaleString()}</div>
                                            <div className="col-span-1 flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-500/20 hover:text-blue-400" onClick={(e) => { e.stopPropagation(); handleDownload(file.Key); }} title={t('download')}>
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/20 hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDelete(file.Key); }} title={t('delete')}>
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'settings' && (
                        <div className="glass-panel p-8 rounded-3xl max-w-2xl mx-auto">
                            <h2 className="text-2xl font-bold mb-6 flex items-center">
                                <Settings className="mr-3 h-6 w-6" /> {t('settings')}
                            </h2>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <div className="space-y-1">
                                        <h3 className="font-medium">{t('appearance')}</h3>
                                        <p className="text-sm text-muted-foreground">{t('appearanceDesc')}</p>
                                    </div>
                                    <Button onClick={toggleTheme} variant="outline" className="rounded-full border-white/10 hover:bg-white/5">
                                        {theme === 'dark' ? (
                                            <>
                                                <Moon className="mr-2 h-4 w-4" /> {t('darkMode')}
                                            </>
                                        ) : (
                                            <>
                                                <Sun className="mr-2 h-4 w-4" /> {t('lightMode')}
                                            </>
                                        )}
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <div className="space-y-1">
                                        <h3 className="font-medium">{t('language')}</h3>
                                        <p className="text-sm text-muted-foreground">{t('languageDesc')}</p>
                                    </div>
                                    <div className="relative">
                                        <div className="group relative">
                                            <Button
                                                variant="outline"
                                                className="rounded-full border-white/10 hover:bg-white/5 min-w-[180px] justify-between"
                                            >
                                                <span className="flex items-center">
                                                    <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    {locales[language]._langName || language}
                                                </span>
                                                <ChevronDown className="h-4 w-4 opacity-50" />
                                            </Button>

                                            {/* Dropdown Menu (Hover-based for simplicity or Click) */}
                                            {/* Since we don't have a click-outside handler easily without deps, using hover or simple toggle */}
                                            {/* Let's implemented a simple CSS-based dropdown on hover for now, or use state if we need persistence */}
                                            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all transform origin-top-right scale-95 group-hover:scale-100">
                                                <div className="p-1">
                                                    {availableLanguages.map(lang => (
                                                        <div
                                                            key={lang}
                                                            onClick={() => setLanguage(lang)}
                                                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${language === lang ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-gray-300 hover:text-white'}`}
                                                        >
                                                            <span>{locales[lang]._langName || lang}</span>
                                                            {language === lang && <Check className="h-3 w-3" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <div className="space-y-1">
                                        <h3 className="font-medium">{t('about')}</h3>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium">{t('author')}</div>
                                        <div className="text-xs text-muted-foreground">Cheerawab</div>
                                        <div className="text-sm font-medium">{t('icon')}</div>
                                        <div className="text-xs text-muted-foreground">Gemini Nano Banana Pro</div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

export default App
