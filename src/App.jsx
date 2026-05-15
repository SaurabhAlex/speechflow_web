import React, { useState } from 'react'

const API_BASE = 'http://localhost:8000'

export default function App() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [profile, setProfile] = useState(null)
    const [token, setToken] = useState('')
    const [users, setUsers] = useState([])
    const [pagination, setPagination] = useState({ page: 1, total_pages: 1 })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showTtsScreen, setShowTtsScreen] = useState(false)
    const [ttsText, setTtsText] = useState('')
    const [ttsLoading, setTtsLoading] = useState(false)
    const [ttsError, setTtsError] = useState('')
    const [audioUrl, setAudioUrl] = useState('')
    const [showSttScreen, setShowSttScreen] = useState(false)
    const [sttFile, setSttFile] = useState(null)
    const [sttLoading, setSttLoading] = useState(false)
    const [sttError, setSttError] = useState('')
    const [sttResult, setSttResult] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const mediaRecorderRef = React.useRef(null)
    const audioChunksRef = React.useRef([])
    const streamRef = React.useRef(null)
    const timerRef = React.useRef(null)

    async function fetchUsers(page = 1, accessToken) {
        try {
            const usersRes = await fetch(`${API_BASE}/user?page=${page}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            })

            if (usersRes.ok) {
                const usersData = await usersRes.json()
                setUsers(usersData.data || [])
                setPagination({
                    page: usersData.page || 1,
                    total_pages: usersData.total_pages || 1
                })
            }
        } catch (err) {
            setUsers([])
        }
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')
        setLoading(true)

        try {
            const loginRes = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            if (!loginRes.ok) {
                throw new Error('Login failed')
            }

            const { access_token } = await loginRes.json()
            setToken(access_token)

            const profileRes = await fetch(`${API_BASE}/profile`, {
                headers: { Authorization: `Bearer ${access_token}` }
            })

            if (!profileRes.ok) {
                throw new Error('Profile request failed')
            }

            const profileData = await profileRes.json()
            setProfile(profileData)
            await fetchUsers(1, access_token)
        } catch (err) {
            setError(err.message || 'Request failed')
            setProfile(null)
            setUsers([])
        } finally {
            setLoading(false)
        }
    }

    async function handleTtsSubmit(event) {
        event.preventDefault()
        setTtsError('')
        setTtsLoading(true)

        if (audioUrl) {
            URL.revokeObjectURL(audioUrl)
            setAudioUrl('')
        }

        try {
            const ttsRes = await fetch(`${API_BASE}/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'audio/mpeg'
                },
                body: JSON.stringify({ text: ttsText, lang: 'en' })
            })

            if (!ttsRes.ok) {
                throw new Error('Text-to-speech request failed')
            }

            const blob = await ttsRes.blob()
            const url = URL.createObjectURL(blob)
            setAudioUrl(url)
        } catch (err) {
            setTtsError(err.message || 'Unable to generate audio')
        } finally {
            setTtsLoading(false)
        }
    }

    async function handleSttSubmit(event) {
        event.preventDefault()
        setSttError('')
        setSttLoading(true)
        setSttResult('')

        try {
            if (!sttFile) {
                throw new Error('Please select or record an audio file')
            }

            const formData = new FormData()
            formData.append('file', sttFile)

            const sttRes = await fetch(`${API_BASE}/stt`, {
                method: 'POST',
                body: formData
            })

            if (!sttRes.ok) {
                throw new Error('Speech-to-text request failed')
            }

            const data = await sttRes.json()
            setSttResult(data.text || '')
        } catch (err) {
            setSttError(err.message || 'Unable to transcribe audio')
        } finally {
            setSttLoading(false)
        }
    }

    async function startRecording() {
        try {
            setSttError('')
            setSttResult('')
            audioChunksRef.current = []
            setRecordingTime(0)

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            const recorderMimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/ogg',
                'audio/wav'
            ]
            const supportedMimeType = recorderMimeTypes.find((type) => MediaRecorder.isTypeSupported(type))
            const mediaRecorder = supportedMimeType
                ? new MediaRecorder(stream, { mimeType: supportedMimeType })
                : new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data)
            }

            mediaRecorder.onstop = () => {
                const mimeType = mediaRecorder.mimeType || supportedMimeType || 'audio/webm'
                const extension = mimeType.includes('ogg')
                    ? 'ogg'
                    : mimeType.includes('webm')
                        ? 'webm'
                        : 'wav'
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
                const file = new File([audioBlob], `recording.${extension}`, { type: mimeType })
                setSttFile(file)
            }

            mediaRecorder.start()
            setIsRecording(true)

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1)
            }, 1000)
        } catch (err) {
            setSttError('Microphone access denied or not available')
            setIsRecording(false)
        }
    }

    function stopRecording() {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop())
            }
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
            setIsRecording(false)
        }
    }

    if (profile && showSttScreen) {
        return (
            <div className="page">
                <div className="card">
                    <h1>Speech to Text</h1>
                    {isRecording && (
                        <div className="recording-indicator">
                            <p>🎤 Recording... {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</p>
                        </div>
                    )}
                    <form onSubmit={handleSttSubmit}>
                        {!isRecording ? (
                            <button
                                type="button"
                                onClick={startRecording}
                                className="btn-success"
                            >
                                🎙️ Start Recording
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="btn-danger"
                            >
                                ⏹️ Stop Recording
                            </button>
                        )}
                        {sttFile && <p className="success">✓ Audio recorded/selected</p>}
                        <label>
                            Or upload audio file
                            <input
                                type="file"
                                accept="audio/*"
                                onChange={(e) => setSttFile(e.target.files?.[0] || null)}
                            />
                        </label>
                        <button type="submit" disabled={sttLoading || !sttFile}>
                            {sttLoading ? 'Transcribing...' : 'Transcribe'}
                        </button>
                    </form>
                    {sttError && <p className="error">{sttError}</p>}
                    {sttResult && (
                        <div>
                            <h3>Transcribed Text:</h3>
                            <p>{sttResult}</p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setShowSttScreen(false)
                            setSttError('')
                            setSttResult('')
                            setSttFile(null)
                            if (isRecording) {
                                stopRecording()
                            }
                            setRecordingTime(0)
                        }}
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    if (profile && showTtsScreen) {
        return (
            <div className="page">
                <div className="card">
                    <h1>Text to Speech</h1>
                    <form onSubmit={handleTtsSubmit}>
                        <label>
                            Enter text
                            <textarea
                                value={ttsText}
                                onChange={(e) => setTtsText(e.target.value)}
                                rows={4}
                                required
                            />
                        </label>
                        <button type="submit" disabled={ttsLoading || !ttsText.trim()}>
                            {ttsLoading ? 'Generating...' : 'Play Speech'}
                        </button>
                    </form>
                    {ttsError && <p className="error">{ttsError}</p>}
                    {audioUrl && (
                        <div>
                            <audio controls src={audioUrl} />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setShowTtsScreen(false)
                            setTtsError('')
                            if (audioUrl) {
                                URL.revokeObjectURL(audioUrl)
                                setAudioUrl('')
                            }
                        }}
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    if (profile) {
        return (
            <div className="page">
                <div className="card">
                    <h1>Dashboard</h1>
                    <p>Welcome, {profile.username || profile.name || profile.email || 'User'}</p>
                    <p>{profile.message || 'Profile loaded successfully'}</p>
                    <h2>Users</h2>
                    {users.length > 0 ? (
                        <>
                            <ul>
                                {users.map((user) => (
                                    <li key={user.id}>
                                        {user.name} ({user.email})
                                    </li>
                                ))}
                            </ul>
                            <div className="pagination">
                                <button
                                    type="button"
                                    disabled={pagination.page === 1}
                                    onClick={() => fetchUsers(pagination.page - 1, token)}
                                >
                                    Previous
                                </button>
                                <span>Page {pagination.page} of {pagination.total_pages}</span>
                                <button
                                    type="button"
                                    disabled={pagination.page === pagination.total_pages}
                                    onClick={() => fetchUsers(pagination.page + 1, token)}
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    ) : (
                        <p>No users found</p>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowTtsScreen(true)}
                    >
                        Text to Speech
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowSttScreen(true)}
                    >
                        Speech to Text
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setProfile(null)
                            setToken('')
                            setUsers([])
                            setPagination({ page: 1, total_pages: 1 })
                            setUsername('')
                            setPassword('')
                            setError('')
                            setShowTtsScreen(false)
                            setTtsError('')
                            if (audioUrl) {
                                URL.revokeObjectURL(audioUrl)
                                setAudioUrl('')
                            }
                            setShowSttScreen(false)
                            setSttError('')
                            setSttResult('')
                            setSttFile(null)
                        }}
                    >
                        Logout
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="page">
            <form className="card" onSubmit={handleSubmit}>
                <h1>Login</h1>
                <label>
                    Username
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </label>
                <button type="submit" disabled={loading}>
                    {loading ? 'Loading...' : 'Submit'}
                </button>
                {error && <p className="error">{error}</p>}
            </form>
        </div>
    )
}
