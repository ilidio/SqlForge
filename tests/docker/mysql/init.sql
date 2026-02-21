CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    country VARCHAR(50)
);

CREATE TABLE inventory (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(100),
    quantity INT
);

INSERT INTO customers (name, country) VALUES 
('Acme Corp', 'USA'),
('Globex', 'UK'),
('Soylent Corp', 'Brazil');

INSERT INTO inventory (item_name, quantity) VALUES 
('Server Rack', 5),
('Fiber Cable', 100),
('Switch 24-Port', 12);
