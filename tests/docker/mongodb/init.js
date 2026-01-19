db = db.getSiblingDB('testdb');
db.users.insertMany([
  { name: "Ilidio", role: "Admin", active: true },
  { name: "Dev", role: "Developer", active: true }
]);
db.projects.insertOne({ title: "SqlForge", status: "In Development" });
