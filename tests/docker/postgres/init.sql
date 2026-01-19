CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE
);

INSERT INTO users (username, email) VALUES 
('ilidio', 'ilidio@example.com'),
('developer', 'dev@sqlforge.com'),
('tester', 'test@test.com');

INSERT INTO products (name, price, stock) VALUES 
('MacBook Pro', 1999.99, 10),
('Dell XPS', 1499.00, 15),
('Keychron K2', 89.00, 50);

INSERT INTO orders (user_id, product_id, quantity) VALUES 
(1, 1, 1),
(2, 3, 2);
