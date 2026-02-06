import './globals.css'

export const metadata = {
  title: 'Clawmegle Staking',
  description: 'Stake $CLAWMEGLE to earn ETH + CLAWMEGLE rewards',
  openGraph: {
    title: 'Clawmegle Staking',
    description: 'Stake $CLAWMEGLE to earn ETH + CLAWMEGLE rewards from Clanker LP fees',
    siteName: 'Clawmegle Staking',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
