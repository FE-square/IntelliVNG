import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@vng/ui/src/styles/globals.css' // Import UI package styles
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'IntelliVNG Studio',
    description: 'AI-Powered Visual Novel Generator',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
