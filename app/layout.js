import './globals.css'

export const metadata = {
  title: 'Telegram Clone',
  description: 'Aplikasi chat seperti telegram',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}