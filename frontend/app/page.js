'use client'
import { useState, useEffect } from 'react'
import { createPublicClient, http, formatEther, formatUnits } from 'viem'
import { base } from 'viem/chains'

const STAKING_CONTRACT = '0x56e687aE55c892cd66018779c416066bc2F5fCf4'
const CLAWMEGLE_TOKEN = '0x94fa5D6774eaC21a391Aced58086CCE241d3507c'

// ABI for the functions we need
const STAKING_ABI = [
  {
    name: 'totalStaked',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'getStakedAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'pendingRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: 'ethPending', type: 'uint256' }, { name: 'clawmeglePending', type: 'uint256' }]
  }
]

const TOKEN_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  }
]

// Create viem client
const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
})

// Format address for display
function formatAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// Format token amount
function formatTokens(amount, decimals = 18) {
  const num = parseFloat(formatUnits(amount, decimals))
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
  return num.toFixed(2)
}

export default function StakingPage() {
  const [stats, setStats] = useState({
    totalStaked: 0n,
    rewardPoolEth: 0n,
    rewardPoolClawmegle: 0n,
    stakerCount: 0
  })
  const [userPosition, setUserPosition] = useState(null)
  const [walletAddress, setWalletAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  // Fetch global stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const [totalStaked, contractEth, contractClawmegle] = await Promise.all([
          client.readContract({
            address: STAKING_CONTRACT,
            abi: STAKING_ABI,
            functionName: 'totalStaked'
          }),
          client.getBalance({ address: STAKING_CONTRACT }),
          client.readContract({
            address: CLAWMEGLE_TOKEN,
            abi: TOKEN_ABI,
            functionName: 'balanceOf',
            args: [STAKING_CONTRACT]
          })
        ])

        // Reward pool = contract balance minus staked amount
        const rewardPoolClawmegle = contractClawmegle > totalStaked 
          ? contractClawmegle - totalStaked 
          : 0n

        setStats({
          totalStaked,
          rewardPoolEth: contractEth,
          rewardPoolClawmegle,
          stakerCount: totalStaked > 0n ? '?' : 0 // Would need events to count
        })
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // Check user position
  async function checkPosition() {
    if (!walletAddress || !walletAddress.startsWith('0x')) return
    setChecking(true)
    try {
      const [staked, pending] = await Promise.all([
        client.readContract({
          address: STAKING_CONTRACT,
          abi: STAKING_ABI,
          functionName: 'getStakedAmount',
          args: [walletAddress]
        }),
        client.readContract({
          address: STAKING_CONTRACT,
          abi: STAKING_ABI,
          functionName: 'pendingRewards',
          args: [walletAddress]
        })
      ])
      setUserPosition({
        staked,
        pendingEth: pending[0],
        pendingClawmegle: pending[1],
        share: stats.totalStaked > 0n 
          ? Number((staked * 10000n) / stats.totalStaked) / 100 
          : 0
      })
    } catch (err) {
      console.error('Failed to check position:', err)
      setUserPosition({ error: 'Could not fetch position' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="logo-row">
          <span style={{ fontSize: '48px' }}>🥩</span>
          <h1 className="logo">clawmegle staking</h1>
        </div>
        <p className="subtitle">Stake $CLAWMEGLE to earn ETH + CLAWMEGLE rewards</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">
            {loading ? '...' : formatTokens(stats.totalStaked)}
          </div>
          <div className="stat-label">Total Staked</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {loading ? '...' : formatTokens(stats.rewardPoolEth) + ' ETH'}
          </div>
          <div className="stat-label">ETH Rewards Pool</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {loading ? '...' : formatTokens(stats.rewardPoolClawmegle)}
          </div>
          <div className="stat-label">CLAWMEGLE Rewards</div>
        </div>
      </div>

      {/* Your Position */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Your Position</h2>
        </div>
        
        {!userPosition ? (
          <div className="connect-prompt">
            <p>Enter your wallet address to check your staking position</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="0x..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  width: '320px',
                  maxWidth: '100%'
                }}
              />
              <button 
                className="btn-primary" 
                onClick={checkPosition}
                disabled={checking || !walletAddress}
              >
                {checking ? 'Checking...' : 'Check'}
              </button>
            </div>
            <p style={{ marginTop: '16px', fontSize: '14px' }}>
              <a href="https://github.com/tedkaczynski-the-bot/clawmegle-staking" target="_blank" rel="noopener">
                → Set up staking via the skill
              </a>
            </p>
          </div>
        ) : userPosition.error ? (
          <div className="connect-prompt">
            <p>{userPosition.error}</p>
            <button className="btn-secondary" onClick={() => setUserPosition(null)}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="position-grid">
              <div className="position-item">
                <div className="position-label">Staked</div>
                <div className="position-value">{formatTokens(userPosition.staked)} CLAWMEGLE</div>
              </div>
              <div className="position-item">
                <div className="position-label">Share</div>
                <div className="position-value">{userPosition.share.toFixed(2)}%</div>
              </div>
              <div className="position-item">
                <div className="position-label">Pending ETH</div>
                <div className="position-value">{formatTokens(userPosition.pendingEth)} ETH</div>
              </div>
              <div className="position-item">
                <div className="position-label">Pending CLAWMEGLE</div>
                <div className="position-value">{formatTokens(userPosition.pendingClawmegle)}</div>
              </div>
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button className="btn-secondary" onClick={() => setUserPosition(null)}>
                Check Another
              </button>
            </div>
          </>
        )}
      </div>

      {/* How It Works */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">How It Works</h2>
        </div>
        <div style={{ color: '#666', lineHeight: 1.6 }}>
          <p style={{ marginBottom: '12px' }}>
            <strong>1. Get the skill</strong> — Install <code>clawmegle-staking</code> skill for your agent
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>2. Set up Bankr</strong> — Create account at <a href="https://bankr.bot" target="_blank">bankr.bot</a> and get API key
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>3. Stake</strong> — Send CLAWMEGLE to your Bankr wallet and run the stake script
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>4. Earn</strong> — Accumulate ETH + CLAWMEGLE rewards proportional to your stake
          </p>
          <p>
            <strong>5. Claim</strong> — Withdraw rewards anytime, or unstake to exit
          </p>
        </div>
      </div>

      {/* Links */}
      <div style={{ textAlign: 'center', marginTop: '20px', color: '#666', fontSize: '14px' }}>
        <a href="https://github.com/tedkaczynski-the-bot/clawmegle-staking" target="_blank">GitHub</a>
        {' · '}
        <a href={`https://basescan.org/address/${STAKING_CONTRACT}`} target="_blank">Contract</a>
        {' · '}
        <a href={`https://basescan.org/token/${CLAWMEGLE_TOKEN}`} target="_blank">Token</a>
        {' · '}
        <a href="https://clawmegle.xyz" target="_blank">Clawmegle</a>
      </div>
    </div>
  )
}
