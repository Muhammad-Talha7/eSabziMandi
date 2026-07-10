import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [liveAuctions, setLiveAuctions] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Prepare params, avoiding sending empty strings
        const params = {};
        if (search) params.search = search;
        if (category) params.category = category;
        if (minPrice) params.min_price = minPrice;
        if (maxPrice) params.max_price = maxPrice;

        const [productsRes, auctionsRes] = await Promise.all([
          api.get('/products/', { params }),
          api.get('/auctions/', { params: { auction_status: 'live,upcoming' } })
        ]);

        setProducts(productsRes.data);
        
        // Cross-reference live auctions by product_id
        // Decision: Fetching auctions separately and cross-referencing is cleaner
        // than changing the backend schema for a frontend specific need.
        const auctionMap = {};
        auctionsRes.data.forEach(auction => {
          auctionMap[auction.product_id] = auction;
        });
        setLiveAuctions(auctionMap);
      } catch (err) {
        console.error("Error fetching data", err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the fetch by 300ms
    const delayDebounceFn = setTimeout(() => {
      fetchData();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, category, minPrice, maxPrice]);

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="container" style={{ padding: 'calc(var(--spacing-unit) * 4) calc(var(--spacing-unit) * 2)' }}>
      <h1 style={{ marginTop: 0, color: 'var(--color-ink)' }}>Marketplace</h1>

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'calc(var(--spacing-unit) * 2)',
        marginBottom: 'calc(var(--spacing-unit) * 4)',
        background: 'var(--color-primary-light)',
        padding: 'calc(var(--spacing-unit) * 2)',
        borderRadius: 'var(--radius)'
      }}>
        <input 
          type="text" 
          placeholder="Search vegetables..." 
          value={search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          style={{ flex: '1 1 200px' }}
        />
        <select 
          value={category} 
          onChange={(e) => handleFilterChange('category', e.target.value)}
          style={{ flex: '1 1 150px' }}
        >
          <option value="">All Categories</option>
          <option value="vegetables">Vegetables</option>
          <option value="fruits">Fruits</option>
          <option value="herbs">Herbs</option>
          <option value="other">Other</option>
        </select>
        <input 
          type="number" 
          placeholder="Min Price" 
          value={minPrice}
          onChange={(e) => handleFilterChange('min_price', e.target.value)}
          style={{ flex: '1 1 100px' }}
        />
        <input 
          type="number" 
          placeholder="Max Price" 
          value={maxPrice}
          onChange={(e) => handleFilterChange('max_price', e.target.value)}
          style={{ flex: '1 1 100px' }}
        />
        {(search || category || minPrice || maxPrice) && (
          <button className="btn-secondary" onClick={clearFilters} style={{ flex: '0 0 auto' }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'calc(var(--spacing-unit) * 8) 0', color: 'var(--color-muted)' }}>
          <p>Loading marketplace...</p>
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div style={{ 
          textAlign: 'center', 
          padding: 'calc(var(--spacing-unit) * 8) 0', 
          background: 'var(--color-white)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius)'
        }}>
          <h3 style={{ margin: '0 0 calc(var(--spacing-unit) * 1) 0' }}>No vegetables match your filters</h3>
          <p style={{ color: 'var(--color-muted)', marginBottom: 'calc(var(--spacing-unit) * 3)' }}>Try adjusting your search or category to find what you're looking for.</p>
          <button className="btn-primary" onClick={clearFilters}>View all products</button>
        </div>
      ) : (
        /* Product Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: 'calc(var(--spacing-unit) * 3)'
        }}>
          {products.map(product => {
            const auction = liveAuctions[product.id];
            const isSoldOut = product.status !== 'active' || parseFloat(product.quantity) <= 0;
            const hasActiveAuction = auction && (auction.status === 'live' || auction.status === 'upcoming');
            
            // Core rule: A product is EITHER available for direct purchase OR under active auction.
            const targetUrl = hasActiveAuction ? `/auction/${auction.id}` : `/products/${product.id}`;

            return (
              <Link to={targetUrl} key={product.id} style={{ display: 'block', height: '100%' }}>
                <div style={{
                  background: 'var(--color-white)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  {/* Image Placeholder */}
                  <div style={{ 
                    height: '160px', 
                    background: 'var(--color-primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: 'var(--color-primary)', fontWeight: '500' }}>No Image</span>
                    )}
                    
                    {/* Live/Upcoming Auction Badge */}
                    {hasActiveAuction && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: auction.status === 'live' ? 'var(--color-error)' : '#f39c12',
                        color: 'var(--color-white)',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {auction.status === 'live' ? 'Live Auction' : 'Upcoming Auction'}
                      </div>
                    )}
                  </div>
                  
                  {/* Card Content */}
                  <div style={{ padding: 'calc(var(--spacing-unit) * 2)', display: 'flex', flexDirection: 'column', flex: '1' }}>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--color-muted)', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 'calc(var(--spacing-unit) * 0.5)'
                    }}>
                      {product.category}
                    </div>
                    <h3 style={{ margin: '0 0 calc(var(--spacing-unit) * 1) 0', fontSize: '1.125rem', color: 'var(--color-ink)' }}>
                      {product.name}
                    </h3>
                    
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {hasActiveAuction ? (
                           <div>
                             <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{auction.status === 'live' ? 'Current Bid:' : 'Starting Price:'} </span>
                             <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--color-primary)' }}>
                               Rs {parseFloat(auction.current_price).toFixed(2)}
                             </span>
                           </div>
                        ) : (
                           <div>
                             <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Buy Now: </span>
                             <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--color-primary)' }}>
                               Rs {parseFloat(product.price).toFixed(2)}
                             </span>
                             <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}> / {product.unit}</span>
                           </div>
                        )}
                      </div>
                      
                      {isSoldOut && !hasActiveAuction ? (
                        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-error)' }}>Sold Out</span>
                      ) : !hasActiveAuction ? (
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-success)' }}>Available</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductList;
