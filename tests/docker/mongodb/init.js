db = db.getSiblingDB('testdb');

db.users.drop();
db.users.insertMany([
  { name: "Ilidio Martins", role: "Admin", active: true, email: "ilidio@example.com", joined: new Date("2025-01-01") },
  { name: "Demo User", role: "Developer", active: true, email: "dev@example.com", joined: new Date("2025-01-15") },
  { name: "Guest", role: "Viewer", active: false, email: "guest@example.com", joined: new Date("2026-01-01") }
]);

db.projects.drop();
db.projects.insertMany([
  { title: "SqlForge", status: "In Development", owner: "Ilidio Martins", tags: ["sql", "react", "python"] },
  { title: "DataViz", status: "Planned", owner: "Demo User", tags: ["d3", "charts"] },
  { title: "Legacy System", status: "Maintenance", owner: "Ilidio Martins", tags: ["cobol", "mainframes"] }
]);

db.settings.drop();
db.settings.insertOne({ 
  theme: "dark", 
  notifications: true, 
  max_rows: 500,
  api_config: {
    retries: 3,
    timeout: 5000
  }
});

db.logs.drop();
db.logs.insertMany([
  { timestamp: new Date(), level: "INFO", message: "Database initialized" },
  { timestamp: new Date(), level: "DEBUG", message: "Loading seed data" }
]);
