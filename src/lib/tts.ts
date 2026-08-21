/**
 * 单词发音（Text-to-Speech）
 * 优先使用浏览器 speechSynthesis 的 en-US 声音，失败时回退到在线发音。
 * 与 legacy 版本（v1）保持一致的发音行为。
 */

let ttsVoice: SpeechSynthesisVoice | null = null
let ttsUnlocked = false

export const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window

function loadTTSVoice() {
  if (!ttsAvailable) {
    return
  }
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    return
  }
  const usVoices = voices.filter((voice) => voice.lang === 'en-US')
  if (usVoices.length > 0) {
    const preferred = usVoices.find((voice) => /google|natural|samantha|aria|daniel|zira/i.test(voice.name))
    ttsVoice = preferred ?? usVoices[0]
  } else {
    ttsVoice = voices.find((voice) => voice.lang.startsWith('en')) ?? voices[0]
  }
}

function unlockTTS() {
  if (ttsUnlocked || !ttsAvailable) {
    return
  }
  ttsUnlocked = true
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance('')
    utterance.volume = 0
    utterance.rate = 1
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  } catch {
    // 浏览器不支持时静默跳过
  }
}

if (typeof window !== 'undefined') {
  ;['touchstart', 'click', 'keydown'].forEach((event) => {
    window.addEventListener(event, unlockTTS, { once: true, passive: true })
  })
  if (ttsAvailable) {
    loadTTSVoice()
    window.speechSynthesis.onvoiceschanged = loadTTSVoice
  }
}

function speakOnline(word: string, onStateChange: (speaking: boolean) => void) {
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
    const audio = new Audio(url)
    onStateChange(true)
    audio.onended = () => onStateChange(false)
    audio.onerror = () => onStateChange(false)
    void audio.play().catch(() => onStateChange(false))
  } catch {
    onStateChange(false)
  }
}

/** 朗读单词。speaking 回调用于按钮的播放态。 */
export function speakWord(word: string, onStateChange: (speaking: boolean) => void = () => {}) {
  if (!ttsAvailable) {
    speakOnline(word, onStateChange)
    return
  }

  try {
    window.speechSynthesis.resume()
    window.speechSynthesis.cancel()
  } catch {
    // 忽略
  }

  window.setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1
    if (ttsVoice) {
      utterance.voice = ttsVoice
    }

    onStateChange(true)
    utterance.onend = () => onStateChange(false)
    utterance.onerror = () => {
      onStateChange(false)
      speakOnline(word, onStateChange)
    }

    try {
      window.speechSynthesis.speak(utterance)
      window.setTimeout(() => {
        try {
          window.speechSynthesis.resume()
        } catch {
          // 忽略
        }
      }, 100)
      // TTS 长时间无输出时回退到在线发音
      window.setTimeout(() => {
        if (utterance && window.speechSynthesis.speaking === false) {
          return
        }
        try {
          window.speechSynthesis.cancel()
        } catch {
          // 忽略
        }
        onStateChange(false)
        speakOnline(word, onStateChange)
      }, 3000)
    } catch {
      onStateChange(false)
      speakOnline(word, onStateChange)
    }
  }, 50)
}
