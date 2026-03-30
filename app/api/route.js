import { connectDB, User, Message, Notification } from '@/lib/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

export async function POST(req) {
  await connectDB()
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  // REGISTER
  if (action === 'register') {
    try {
      const formData = await req.formData()
      const username = formData.get('username')
      const password = formData.get('password')
      const photo = formData.get('photo')
      
      const existingUser = await User.findOne({ username })
      if (existingUser) {
        return Response.json({ error: 'Username sudah digunakan' }, { status: 400 })
      }
      
      const hashedPassword = await bcrypt.hash(password, 10)
      let photoUrl = '/default-avatar.png'
      
      if (photo && photo.size > 0) {
        const bytes = await photo.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')
        photoUrl = `data:${photo.type};base64,${base64}`
      }
      
      const user = await User.create({
        username,
        password: hashedPassword,
        photo: photoUrl,
        isOwner: username === 'wilzz'
      })
      
      // Kirim notifikasi ke owner
      const owner = await User.findOne({ isOwner: true })
      if (owner) {
        await Notification.create({
          to: owner.username,
          from: username,
          message: `📢 User baru bergabung: ${username}`,
          type: 'new_user',
          timestamp: new Date()
        })
        
        // Kirim pesan sistem di grup
        await Message.create({
          username: 'System',
          text: `✨ Selamat datang ${username} bergabung di grup! ✨`,
          isSystemMessage: true,
          timestamp: new Date()
        })
      }
      
      return Response.json({ success: true, message: 'Registrasi berhasil' })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  // LOGIN
  if (action === 'login') {
    try {
      const { username, password } = await req.json()
      const user = await User.findOne({ username })
      
      if (!user || !await bcrypt.compare(password, user.password)) {
        return Response.json({ error: 'Username atau password salah' }, { status: 401 })
      }
      
      // Update last seen
      await User.findByIdAndUpdate(user._id, { lastSeen: new Date() })
      
      const token = jwt.sign(
        { userId: user._id, username: user.username, isOwner: user.isOwner, photo: user.photo },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
      
      cookies().set('token', token, { httpOnly: true, maxAge: 604800 })
      return Response.json({ token, user: { username: user.username, photo: user.photo, isOwner: user.isOwner } })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  // SEND MESSAGE (Group atau Private)
  if (action === 'sendMessage') {
    try {
      const auth = req.headers.get('authorization')
      const token = auth?.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      const { text, toUser } = await req.json()
      
      let messageData = {
        username: decoded.username,
        userId: decoded.userId,
        text,
        timestamp: new Date()
      }
      
      // Jika toUser ada, kirim private message
      if (toUser) {
        messageData.forUser = toUser
        messageData.isSystemMessage = false
        
        // Buat notifikasi untuk penerima
        await Notification.create({
          to: toUser,
          from: decoded.username,
          message: `💬 Pesan private dari ${decoded.username}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
          type: 'private_message',
          timestamp: new Date()
        })
      }
      
      const message = await Message.create(messageData)
      
      return Response.json({ success: true, message })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  // SEND IMAGE
  if (action === 'sendImage') {
    try {
      const auth = req.headers.get('authorization')
      const token = auth?.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      const formData = await req.formData()
      const image = formData.get('image')
      const toUser = formData.get('toUser')
      
      let imageUrl = ''
      if (image && image.size > 0) {
        const bytes = await image.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')
        imageUrl = `data:${image.type};base64,${base64}`
      }
      
      let messageData = {
        username: decoded.username,
        userId: decoded.userId,
        image: imageUrl,
        timestamp: new Date()
      }
      
      if (toUser && toUser !== 'null') {
        messageData.forUser = toUser
        
        await Notification.create({
          to: toUser,
          from: decoded.username,
          message: `🖼️ Mengirim foto private dari ${decoded.username}`,
          type: 'private_message',
          timestamp: new Date()
        })
      }
      
      const message = await Message.create(messageData)
      
      return Response.json({ success: true, message })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  return Response.json({ error: 'Action tidak ditemukan' }, { status: 400 })
}

export async function GET(req) {
  await connectDB()
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  
  // GET MESSAGES (Group + Private)
  if (action === 'messages') {
    try {
      const auth = req.headers.get('authorization')
      const token = auth?.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      // Ambil semua pesan group (forUser = null) + pesan private yang melibatkan user ini
      const messages = await Message.find({
        $or: [
          { forUser: null }, // Group messages
          { forUser: decoded.username }, // Private messages untuk user ini
          { username: decoded.username, forUser: { $ne: null } } // Private messages dari user ini
        ]
      }).sort({ timestamp: 1 }).limit(200)
      
      return Response.json({ messages })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  // GET NOTIFICATIONS
  if (action === 'notifications') {
    try {
      const auth = req.headers.get('authorization')
      const token = auth?.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      const notifications = await Notification.find({ 
        to: decoded.username,
        isRead: false
      }).sort({ timestamp: -1 }).limit(50)
      
      return Response.json({ notifications })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  // MARK NOTIFICATION READ
  if (action === 'markRead') {
    try {
      const auth = req.headers.get('authorization')
      const token = auth?.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      await Notification.updateMany(
        { to: decoded.username, isRead: false },
        { isRead: true }
      )
      
      return Response.json({ success: true })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  // GET ALL USERS (for private chat)
  if (action === 'users') {
    try {
      const auth = req.headers.get('authorization')
      const token = auth?.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      const users = await User.find({}, 'username photo isOwner lastSeen')
      return Response.json({ users })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  // GET CURRENT USER
  if (action === 'me') {
    try {
      const auth = req.headers.get('authorization')
      const token = auth?.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      
      return Response.json({
        user: {
          username: user.username,
          photo: user.photo,
          isOwner: user.isOwner
        }
      })
    } catch (error) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  
  return Response.json({ error: 'Action tidak ditemukan' }, { status: 400 })
}

export async function PUT(req) {
  await connectDB()
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  
  // UPDATE PHOTO
  if (action === 'updatePhoto') {
    try {
      const auth = req.headers.get('authorization')
      const token = auth?.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      const formData = await req.formData()
      const photo = formData.get('photo')
      
      let photoUrl = '/default-avatar.png'
      if (photo && photo.size > 0) {
        const bytes = await photo.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')
        photoUrl = `data:${photo.type};base64,${base64}`
      }
      
      const user = await User.findByIdAndUpdate(
        decoded.userId,
        { photo: photoUrl },
        { new: true }
      )
      
      return Response.json({ success: true, photo: user.photo })
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }
  
  return Response.json({ error: 'Action tidak ditemukan' }, { status: 400 })
}