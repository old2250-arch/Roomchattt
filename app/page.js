'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setCookie } from 'cookies-next'

export default function Home() {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      let res
      if (isLogin) {
        res = await fetch('/api?action=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
      } else {
        const formData = new FormData()
        formData.append('username', username)
        formData.append('password', password)
        if (photo) formData.append('photo', photo)
        
        res = await fetch('/api?action=register', {
          method: 'POST',
          body: formData
        })
      }

      const data = await res.json()
      
      if (res.ok) {
        if (isLogin) {
          setCookie('token', data.token)
          router.push('/chat')
        } else {
          setIsLogin(true)
          alert('Registrasi berhasil! Silakan login.')
        }
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Terjadi kesalahan')
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          {!isLogin && (
            <>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="photo-preview" />
              )}
            </>
          )}
          
          <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
          <button
            type="button"
            className="toggle-btn"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
            }}
          >
            {isLogin ? 'Buat akun baru' : 'Sudah punya akun? Login'}
          </button>
          {error && <div className="error">{error}</div>}
        </form>
      </div>
    </div>
  )
}