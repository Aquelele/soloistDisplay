import { useState, useEffect, useRef, useContext } from 'react'

import './App.css'

function App() {

  const [soloist_playback_state, setSoloist_playback_state] = useState('')

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [cover, setCover] = useState('')
  const [volume, setVolume] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [queue, setQueue] = useState([])
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off')

  const ws = useRef<WebSocket | null>(null)


  useEffect(() => {
    const socket = new WebSocket('ws://192.168.1.90:9090')
    ws.current = socket

    socket.onopen = () => {
      console.log('Connected to WebSocket server')
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)

      console.log('Received message:', data)

      if (data.type === 'playback_state') {
        setSoloist_playback_state(event.data)

        setTitle(
          data.item?.decorations?.identity?.name ?? 'Unknown Title'
        )

        setAlbum(
          data.item?.decorations?.parent?.entity?.decorations?.identity?.name
          ?? 'Unknown Album'
        )

        setArtist(
          data.item?.decorations?.creators?.[0]?.entity?.decorations?.identity?.name
          ?? 'Unknown Artist'
        )

        setCover(
          data.item?.decorations?.visual_identity?.cover?.at(-1)?.url
          ?? ''
        )

        setVolume(data.volume ?? 0)

        setPosition(data.position.position_ms ?? 0)

        setDuration(data.item.decorations.playback.duration_ms ?? 0)

        setPlaying(data.status === 'playing')

        setShuffle(data.options.shuffle ?? false)

        setRepeat(data.options.repeat ?? 'off')
      }

      if (data.type === 'volume_changed') {
        setVolume(data.volume)
        console.log('Volume changed:', data.volume)
      }

      if (data.type === 'queue_changed') {
        console.log('Queue changed:', data.upcoming)
        if (!data.upcoming || data.upcoming.length <= 1) {
          setQueue([])
          console.log('Queue is empty')
          // sendMessage(JSON.stringify({ type: "command", command: "get_queue", limit: 10 }))
        } else {
          setQueue(data.upcoming)
          // console.log('Queue changed:', JSON.stringify(data.upcoming[0]))
        }

      }

      if (data.type === 'playback_changed') {
        console.log('Playback changed:', data)
      }

    }

    socket.onclose = (event) => {
      console.log('Disconnected from WebSocket server')
      console.log('Close code:', event.code)
      console.log('Close reason:', event.reason)
      console.log('Clean:', event.wasClean)
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return () => {
      socket.close()
    }
  }, [])


  function sendMessage(message: string) {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(message)
      console.log('Sent message:', message)
    } else {
      console.error('WebSocket is not open. Ready state:', ws.current ? ws.current.readyState : 'Unknown')
    }
  }

  function handleVolumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newVolume = parseInt(event.target.value)
    setVolume(newVolume)
    var message = JSON.stringify({ type: "command", command: "set_volume", volume: newVolume })
    console.log('Sending message:', message)
    sendMessage(message)
  }

  function get_average_rgb(imageUrl: string): Promise<{ r: number, g: number, b: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.src = imageUrl

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let r = 0, g = 0, b = 0
        const pixelCount = data.length / 4

        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
        }

        r = Math.floor(r / pixelCount)
        g = Math.floor(g / pixelCount)
        b = Math.floor(b / pixelCount)

        resolve({ r, g, b })
      }

      img.onerror = (error) => {
        reject(error)
      }
    })
  }

  function getCommonColorFromImage(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.src = imageUrl

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        const colorCount: { [key: string]: number } = {}

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          if (a === 0) continue

          const colorKey = `${r},${g},${b}`
          colorCount[colorKey] = (colorCount[colorKey] || 0) + 1
        }

        let mostCommonColor = ''
        let maxCount = 0

        for (const color in colorCount) {
          if (colorCount[color] > maxCount) {
            maxCount = colorCount[color]
            mostCommonColor = color
          }
        }

        resolve(`rgb(${mostCommonColor})`)
      }

      img.onerror = (error) => {
        reject(error)
      }
    })
  }

  function getDominantColorFromImage(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.src = imageUrl

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let rTotal = 0, gTotal = 0, bTotal = 0
        let pixelCount = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          if (a === 0) continue

          rTotal += r
          gTotal += g
          bTotal += b
          pixelCount++
        }

        const rAvg = Math.floor(rTotal / pixelCount)
        const gAvg = Math.floor(gTotal / pixelCount)
        const bAvg = Math.floor(bTotal / pixelCount)

        resolve(`rgb(${rAvg}, ${gAvg}, ${bAvg})`)
      }

      img.onerror = (error) => {
        reject(error)
      }
    })
  }

  function getContrastColor(rgbString: string): string {
    const rgbValues = rgbString.match(/\d+/g)
    if (!rgbValues) return '#08060d'

    const r = parseInt(rgbValues[0])
    const g = parseInt(rgbValues[1])
    const b = parseInt(rgbValues[2])

    const brightness = (r * 299 + g * 587 + b * 114) / 1000

    return brightness > 128 ? '#08060d' : '#f3f4f6'
  }

  function getAccentColorFromImage(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.src = imageUrl

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let rTotal = 0, gTotal = 0, bTotal = 0
        let pixelCount = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          if (a === 0) continue

          rTotal += r
          gTotal += g
          bTotal += b
          pixelCount++
        }

        const rAvg = Math.floor(rTotal / pixelCount)
        const gAvg = Math.floor(gTotal / pixelCount)
        const bAvg = Math.floor(bTotal / pixelCount)

        resolve(`rgb(${rAvg}, ${gAvg}, ${bAvg})`)
      }

      img.onerror = (error) => {
        reject(error)
      }
    })
  }

  function getMostVibrantColorFromImage(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.src = imageUrl

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let maxSaturation = 0
        let vibrantColor = ''

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          if (a === 0) continue

          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const saturation = (max - min) / max

          if (saturation > maxSaturation) {
            maxSaturation = saturation
            vibrantColor = `rgb(${r}, ${g}, ${b})`
          }
        }

        resolve(vibrantColor)
      }

      img.onerror = (error) => {
        reject(error)
      }
    })
  }


  useEffect(() => {
    if (cover) {
      document.documentElement.style.setProperty('--background-image', `url(${cover})`)
      get_average_rgb(cover)
        .then(({ r, g, b }) => {
          const rgbString = `rgb(${r}, ${g}, ${b})`
          console.log('Average RGB:', rgbString)
          document.documentElement.style.setProperty('--averageAlbumColor', rgbString)
          document.documentElement.style.setProperty('--contrastAverageAlbumColor', getContrastColor(rgbString))
        })
        .catch((error) => {
          console.error('Error calculating average RGB:', error)
        })

      getCommonColorFromImage(cover)
        .then((commonColor) => {
          console.log('Most common color:', commonColor)
          document.documentElement.style.setProperty('--commonAlbumColor', commonColor)
          document.documentElement.style.setProperty('--contrastCommonAlbumColor', getContrastColor(commonColor))
          // You can use the commonColor for further processing if needed
        })
        .catch((error) => {
          console.error('Error calculating most common color:', error)
        })

      getDominantColorFromImage(cover)
        .then((dominantColor) => {
          console.log('Dominant color:', dominantColor)
          document.documentElement.style.setProperty('--dominantAlbumColor', dominantColor)
          document.documentElement.style.setProperty('--contrastDominantAlbumColor', getContrastColor(dominantColor))
          // You can use the dominantColor for further processing if needed
        })
        .catch((error) => {
          console.error('Error calculating dominant color:', error)
        })

      getAccentColorFromImage(cover)
        .then((accentColor) => {
          console.log('Accent color:', accentColor)
          document.documentElement.style.setProperty('--accent', accentColor)
          // You can use the accentColor for further processing if needed
        })
        .catch((error) => {
          console.error('Error calculating accent color:', error)
        })

      getMostVibrantColorFromImage(cover)
        .then((vibrantColor) => {
          console.log('Most vibrant color:', vibrantColor)
          document.documentElement.style.setProperty('--vibrantAlbumColor', vibrantColor)
          document.documentElement.style.setProperty('--contrastVibrantAlbumColor', getContrastColor(vibrantColor))
          // You can use the vibrantColor for further processing if needed
        })
        .catch((error) => {
          console.error('Error calculating most vibrant color:', error)
        })
    }
  }, [cover])


  useEffect(() => {
    const volumePercentage = `${volume}%`
    document.documentElement.style.setProperty('--volume', volumePercentage)
  }, [volume])

  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (playing) {
        setPosition((prevPosition) => {
          const newPosition = prevPosition + 100
          return newPosition <= duration ? newPosition : duration
        })
      }
    }, 100)

    return () => clearInterval(interval)
  }, [playing, duration])

  useEffect(() => {
    const progressPercentage = (position / duration) * 100
    document.documentElement.style.setProperty('--progress', `${progressPercentage + 0.1}%`)
  }, [position, duration])

  function queueItemClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const queueItem = event.currentTarget
    const index = Array.from(queueItem.parentElement!.children).indexOf(queueItem)
    const item = queue[index]
    const uri = item?.item?.uri
    sendMessage(JSON.stringify({ type: "command", command: "play", uri: uri }))
  }

  function handleShuffleClick() {
    sendMessage(JSON.stringify({ type: "command", command: "set_shuffle", enabled: !shuffle }))
    const newShuffleState = !shuffle
    setShuffle(newShuffleState)
  }

  useEffect(() => {
    const shuffleColor = shuffle ? 'var(--accent)' : 'none'
    document.documentElement.style.setProperty('--shuffleColor', shuffleColor)
  }, [shuffle])

  return (
    <>
      {/* <div className="background"></div> */}
      <div className="centering">
        <div className="main">
          <img id="album-cover" src={cover} alt="Album Cover" />
          <div className="player-info">
            <div className="progress-container">
              <input className="progress-bar" type="range" min="0" max={duration} value={position} />
              <div className="progress-time">
                <span className="timestamp">{formatTime(position)}</span>
                <span className="songlength">{formatTime(duration)}</span>
              </div>
            </div>
            <div className="player-rest">
              <div className="player-info2">
                <h3>{title}</h3>
                <h4>{album}</h4>
                <h4>{artist}</h4>
                <div className="playback-controls">
                  <button className="shuffle-button" onClick={handleShuffleClick}>
                    <svg xmlns="http://w3.org" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.54 5.46 20 17.97 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                    </svg>
                  </button>
                  <button className="control-button" onClick={() => sendMessage(JSON.stringify({ type: "command", command: "skip_prev" }))}>
                    <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="19 20 9 12 19 4 19 20" />
                      <rect x="5" y="4" width="2" height="16" />
                    </svg>
                  </button>
                  <button className="play-button" onClick={() => sendMessage(JSON.stringify({ type: "command", command: playing ? "pause" : "play" }))}>
                    {playing ? (
                      <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>
                  <button className="control-button" onClick={() => sendMessage(JSON.stringify({ type: "command", command: "skip_next" }))}>
                    <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 4 15 12 5 20 5 4" />
                      <rect x="17" y="4" width="2" height="16" />
                    </svg>
                  </button>
                  <button className="repeat-button" onClick={() => sendMessage(JSON.stringify({ type: "command", command: "set_repeat", mode: { repeat: repeat === 'off' ? 'context' : repeat === 'context' ? 'track' : 'off' } }))}>
                    {repeat === 'off' && (
                      <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z" />
                      </svg>
                    )}
                    {repeat === 'context' && (
                      <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z" />
                        <path d="M17.5 12c0-2.48-2.02-4.5-4.5-4.5S8.5 9.52 8.5 12s2.02 4.5 4.5 4.5 4.5-2.02 4.5-4.5zm-6 0c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5-2.5-1.12-2.5-2.5z" />
                      </svg>
                    )}
                    {repeat === 'track' && (
                      <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z" />
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="volume-control">
                  <input className="volume-slider" type="range" min="0" max="100" value={volume} onChange={handleVolumeChange} />
                </div>
              </div>
              <div className="queue-container">
                <h5>Up Next</h5>
                <div className="queue">
                  {queue.map((item, index) => (
                    <div key={index} className="queue-item" onClick={queueItemClick}>
                      <img src={item?.item?.decorations.visual_identity.cover.at(-1)?.url} alt="Queue Cover" />
                      <div className="queue-item-info">
                        <h5>{item?.item?.decorations.identity.name}</h5>
                        <h6>{item?.item?.decorations.creators[0].entity.decorations.identity.name}</h6>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
