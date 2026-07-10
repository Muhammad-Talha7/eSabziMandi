-- eSabziMandi Mock Data Script
-- NOTE: This script will clear existing data. Run with caution!

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE deliveries;
TRUNCATE TABLE payments;
TRUNCATE TABLE orders;
TRUNCATE TABLE bids;
TRUNCATE TABLE auctions;
TRUNCATE TABLE products;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users
-- password_hash is for "password123" (bcrypt)
INSERT INTO users (name, email, password_hash, role, phone, verified, created_at) VALUES
('Admin User', 'admin@test.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQqiRQYq', 'admin', '03001234567', 1, NOW()),
('Ali Farmer', 'farmer@test.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQqiRQYq', 'farmer', '03001112222', 1, NOW()),
('Zain Buyer', 'buyer@test.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQqiRQYq', 'buyer', '03003334444', 1, NOW()),
('Ahmed Rider', 'rider@test.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQqiRQYq', 'rider', '03005556666', 1, NOW());

-- 2. Products
INSERT INTO products (farmer_id, name, category, price, starting_price, quantity, unit, image_url, status, created_at) VALUES
(2, 'Fresh Tomatoes', 'vegetables', 150.00, 100.00, 50.00, 'kg', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500', 'active', NOW()),
(2, 'Premium Potatoes', 'vegetables', 80.00, 50.00, 100.00, 'kg', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500', 'active', NOW()),
(2, 'Red Onions', 'vegetables', 120.00, 90.00, 30.00, 'kg', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500', 'active', NOW()),
(2, 'Mangoes (Sindhri)', 'fruits', 400.00, 300.00, 20.00, 'dozen', 'https://images.unsplash.com/photo-1553279768-865429fd01a9?w=500', 'active', NOW());

-- 3. Auctions
-- Product 2 (Potatoes): Live Auction (Started 1 hr ago, ends in 1 hr)
INSERT INTO auctions (product_id, starting_price, current_price, start_time, end_time, status) VALUES
(2, 50.00, 65.00, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 1 HOUR), 'live');

-- Product 3 (Onions): Upcoming Auction (Starts in 1 hr, ends in 3 hrs)
INSERT INTO auctions (product_id, starting_price, current_price, start_time, end_time, status) VALUES
(3, 90.00, 90.00, DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 3 HOUR), 'upcoming');

-- 4. Bids
-- Bids for the Live Auction on Potatoes (Auction ID 1)
INSERT INTO bids (auction_id, buyer_id, amount, created_at) VALUES
(1, 3, 55.00, DATE_SUB(NOW(), INTERVAL 45 MINUTE)),
(1, 3, 60.00, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(1, 3, 65.00, DATE_SUB(NOW(), INTERVAL 10 MINUTE));

-- 5. Orders 
-- Direct purchase of Tomatoes
INSERT INTO orders (buyer_id, product_id, total_amount, status, created_at) VALUES
(3, 1, 300.00, 'pending', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- 6. Payments
INSERT INTO payments (order_id, amount, method, status, created_at) VALUES
(1, 300.00, 'card', 'success', DATE_SUB(NOW(), INTERVAL 23 HOUR));

-- 7. Deliveries
-- Deliver the Tomatoes
INSERT INTO deliveries (order_id, rider_id, status) VALUES
(1, 4, 'assigned');
