import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';

const AuctionRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, role, user } = useAuth();
  
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  const [bidAmount, setBidAmount] = useState('');
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting, connected, polling, disconnected
  const [wsError, setWsError] = useState('');
  
  const [timeRemaining, setTimeRemaining] = useState('');
  const [priceFlash, setPriceFlash] = useState(false);
  
  const wsRef = useRef(null);
  const pollingRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // 1. Initial Data Fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [auctionRes, bidsRes] = await Promise.all([
          api.get(`/auctions/${id}`),
          api.get(`/auctions/${id}/bids`)
        ]);
        setAuction(auctionRes.data);
        setBids(bidsRes.data);
        setBidAmount((parseFloat(auctionRes.data.current_price) + 5).toString());
      } catch (err) {
        if (err.response?.status === 404) setNotFound(true);
        console.error("Failed to load auction", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [id]);

  // 2. WebSocket & Polling Logic
  useEffect(() => {
    if (loading || notFound || !auction) return;
    
    // We only open WS if auction is not closed.
    if (auction.status === 'closed') {
      setWsStatus('disconnected');
      return;
    }

    const connectWs = () => {
      if (wsRef.current) return;
      
      const wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
      const wsUrl = `${wsBase}/ws/auctions/${id}${token ? `?token=${token}` : ''}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        reconnectAttempts.current = 0;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.event === 'bid_placed') {
          setWsError('');
          setAuction(prev => ({ ...prev, current_price: data.amount }));
          
          setPriceFlash(true);
          setTimeout(() => setPriceFlash(false), 500);
          
          const newBid = {
            id: data.bid_id || Date.now(),
            buyer_id: data.buyer_id || data.user_id, // backend broadcasts buyer_id
            amount: data.amount,
            created_at: new Date().toISOString()
          };
          setBids(prev => [newBid, ...prev].slice(0, 20)); // Keep top 20 visible
          
          setBidAmount(prev => {
            const currentInput = parseFloat(prev);
            const newMin = parseFloat(data.amount) + 5;
            return (isNaN(currentInput) || currentInput <= newMin) ? newMin.toString() : prev;
          });

        } else if (data.event === 'error') {
          setWsError(data.message);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (auction.status === 'closed') return; // expected close
        
        if (reconnectAttempts.current < 1) {
          reconnectAttempts.current += 1;
          setWsStatus('connecting');
          setTimeout(connectWs, 2000);
        } else {
          setWsStatus('polling');
          startPolling();
        }
      };
      
      ws.onerror = () => {
        // handled by onclose
      };
    };

    const startPolling = () => {
      if (pollingRef.current) return;
      pollingRef.current = setInterval(async () => {
        try {
          const [auctionRes, bidsRes] = await Promise.all([
            api.get(`/auctions/${id}`),
            api.get(`/auctions/${id}/bids`)
          ]);
          
          setAuction(prev => {
            if (prev.current_price !== auctionRes.data.current_price) {
               setPriceFlash(true);
               setTimeout(() => setPriceFlash(false), 500);
            }
            return auctionRes.data;
          });
          setBids(bidsRes.data.slice(0, 20));
          
          if (auctionRes.data.status === 'closed') {
             clearInterval(pollingRef.current);
          }
        } catch (e) {
          console.error("Polling failed", e);
        }
      }, 5000);
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [id, loading, notFound, auction?.status, token]);

  // 3. Countdown Timer
  useEffect(() => {
    if (!auction || auction.status === 'closed') return;

    const updateTimer = () => {
      const now = new Date();
      // Assume backend returns UTC timezone-naive datetime (e.g. 2026-07-10T12:00:00)
      // Append Z so JS parses it as UTC
      const start = new Date(auction.start_time + 'Z');
      const end = new Date(auction.end_time + 'Z');

      if (now < start) {
        const diff = start - now;
        setTimeRemaining(`Starts in ${formatDuration(diff)}`);
      } else if (now >= start && now <= end) {
        const diff = end - now;
        setTimeRemaining(`Ends in ${formatDuration(diff)}`);
      } else {
        setTimeRemaining('Auction ending...');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  const formatDuration = (ms) => {
    if (ms < 0) return '0s';
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // 4. Handle Bid Submission
  const handlePlaceBid = (e) => {
    e.preventDefault();
    setWsError('');
    
    const amount = parseFloat(bidAmount);
    if (isNaN(amount)) {
      setWsError("Please enter a valid amount.");
      return;
    }
    
    if (amount <= parseFloat(auction.current_price)) {
       setWsError(`Bid must be strictly greater than Rs ${parseFloat(auction.current_price).toFixed(2)}`);
       return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ amount }));
    } else {
      setWsError("Live connection unavailable. Cannot place bid right now.");
    }
  };

  // Renders
  if (loading) {
    return (
      <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 8) 0', textAlign: 'center', color: 'var(--color-muted)' }}>
        Loading auction details...
      </div>
    );
  }

  if (notFound || !auction) {
    return (
      <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 8) 0', textAlign: 'center' }}>
        <h2>Auction Not Found</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 'calc(var(--spacing-unit) * 3)' }}>This auction may have been removed or does not exist.</p>
        <Link to="/products"><button className="btn-primary">Back to Marketplace</button></Link>
      </div>
    );
  }

  const isLive = auction.status === 'live';
  const isUpcoming = auction.status === 'upcoming';
  const isClosed = auction.status === 'closed';
  
  const userWon = isClosed && auction.highest_bidder_id === user?.id;

  return (
    <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 4) calc(var(--spacing-unit) * 2)' }}>
      <Link to="/products" style={{ color: 'var(--color-muted)', display: 'inline-block', marginBottom: 'calc(var(--spacing-unit) * 3)' }}>
        ← Back to Marketplace
      </Link>
      
      {userWon && (
         <div style={{ 
          background: 'var(--color-success)', 
          color: 'var(--color-white)', 
          padding: 'calc(var(--spacing-unit) * 2)', 
          borderRadius: 'var(--radius)',
          marginBottom: 'calc(var(--spacing-unit) * 3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Congratulations, you won this auction!</strong>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Your winning bid was Rs {parseFloat(auction.highest_bid || auction.current_price).toFixed(2)}.</div>
          </div>
          <Link to="/orders"><button style={{ background: 'var(--color-white)', color: 'var(--color-success)', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>Complete Payment</button></Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'calc(var(--spacing-unit) * 4)' }}>
        
        {/* Left Column: Auction Info & Bid Input */}
        <div>
           {/* Connection Status Indicator */}
           {!isClosed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'calc(var(--spacing-unit) * 2)', fontSize: '0.875rem', color: 'var(--color-muted)' }}>
              <div style={{ 
                width: '8px', height: '8px', borderRadius: '50%', 
                backgroundColor: wsStatus === 'connected' ? 'var(--color-success)' : 
                                 wsStatus === 'connecting' ? '#f39c12' : 'var(--color-error)' 
              }} />
              {wsStatus === 'connected' ? 'Live connected' : 
               wsStatus === 'connecting' ? 'Connecting...' : 
               'Live updates unavailable (polling)'}
            </div>
           )}

           <h1 style={{ margin: '0 0 calc(var(--spacing-unit) * 1) 0', color: 'var(--color-ink)' }}>Auction: Product #{auction.product_id}</h1>
           <div style={{ color: 'var(--color-muted)', marginBottom: 'calc(var(--spacing-unit) * 4)' }}>
             Product ID: {auction.product_id}
           </div>
           
           <div style={{ 
             background: 'var(--color-primary-light)', 
             padding: 'calc(var(--spacing-unit) * 4)', 
             borderRadius: 'var(--radius)',
             border: '1px solid var(--color-border)',
             marginBottom: 'calc(var(--spacing-unit) * 4)'
           }}>
             <div style={{ color: 'var(--color-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', marginBottom: 'calc(var(--spacing-unit) * 1)' }}>
               Current Price
             </div>
             
             <div style={{ 
               fontSize: '3rem', 
               fontWeight: 'bold', 
               color: 'var(--color-primary)', 
               lineHeight: 1,
               marginBottom: 'calc(var(--spacing-unit) * 2)',
               transition: 'color 0.3s',
               ...(priceFlash ? { color: 'var(--color-success)' } : {})
             }}>
               Rs {parseFloat(auction.current_price).toFixed(2)}
             </div>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isLive ? 'var(--color-error)' : 'var(--color-ink)', fontWeight: '500' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                {timeRemaining}
             </div>
           </div>

           {/* Bidding UI */}
           {isLive && (
             <form onSubmit={handlePlaceBid}>
               <label htmlFor="bidAmount">Your Bid (Rs)</label>
               <div style={{ display: 'flex', gap: 'calc(var(--spacing-unit) * 2)', alignItems: 'stretch' }}>
                 <input 
                   type="number" 
                   id="bidAmount"
                   value={bidAmount}
                   onChange={(e) => setBidAmount(e.target.value)}
                   min={parseFloat(auction.current_price) + 1}
                   step="0.01"
                   style={{ flex: 1 }}
                   disabled={!token || role !== 'buyer'}
                 />
                 
                 {!token ? (
                   <button type="button" className="btn-primary" onClick={() => navigate('/login')}>Log in to bid</button>
                 ) : role === 'buyer' ? (
                   <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>Place Bid</button>
                 ) : (
                   <button type="button" className="btn-secondary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>Only buyers can bid</button>
                 )}
               </div>
               
               {wsError && (
                 <div style={{ 
                   color: 'var(--color-error)', 
                   fontSize: '0.875rem', 
                   marginTop: 'calc(var(--spacing-unit) * 1)',
                   paddingLeft: 'calc(var(--spacing-unit) * 1)',
                   borderLeft: '2px solid var(--color-error)'
                 }}>
                   {wsError}
                 </div>
               )}
             </form>
           )}
           
           {isUpcoming && (
             <div style={{ background: '#f9fbfd', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', textAlign: 'center' }}>
               Auction hasn't started yet.
             </div>
           )}
           
           {isClosed && (
             <div style={{ background: '#f9fbfd', padding: 'calc(var(--spacing-unit) * 3)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', textAlign: 'center' }}>
               Auction ended. 
               {auction.highest_bidder_id ? ` Winning bid: Rs ${parseFloat(auction.highest_bid || auction.current_price).toFixed(2)}` : ' No bids were placed.'}
             </div>
           )}
        </div>

        {/* Right Column: Bid History */}
        <div>
          <h3 style={{ margin: '0 0 calc(var(--spacing-unit) * 2) 0', color: 'var(--color-ink)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'calc(var(--spacing-unit) * 1)' }}>
            Bid History
          </h3>
          
          {bids.length === 0 ? (
            <div style={{ color: 'var(--color-muted)', fontStyle: 'italic', padding: 'calc(var(--spacing-unit) * 2) 0' }}>
              No bids placed yet. Be the first!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--spacing-unit) * 1)' }}>
              {bids.map((bid, index) => (
                <div key={bid.id || index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: 'calc(var(--spacing-unit) * 1.5)',
                  background: index === 0 ? 'var(--color-primary-light)' : 'var(--color-white)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  transition: 'background 0.3s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--spacing-unit) * 1.5)' }}>
                    <div style={{ 
                      width: '32px', height: '32px', 
                      borderRadius: '50%', 
                      background: 'var(--color-border)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-muted)'
                    }}>
                      B{bid.buyer_id}
                    </div>
                    <div style={{ color: 'var(--color-ink)', fontWeight: '500' }}>
                      Bidder {bid.buyer_id}
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 'normal' }}>
                        {/* Assuming UTC naive input, format local */}
                        {new Date(bid.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>
                    Rs {parseFloat(bid.amount).toFixed(2)}
                  </div>
                </div>
              ))}
              
              {bids.length >= 20 && (
                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: 'calc(var(--spacing-unit) * 2)' }}>
                  Showing latest 20 bids
                </div>
              )}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default AuctionRoom;
