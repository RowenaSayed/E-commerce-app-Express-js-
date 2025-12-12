// test-connect-mongo.js
const MongoStore = require('connect-mongo');
console.log('=== DEBUG CONNECT-MONGO ===');
console.log('Type of MongoStore:', typeof MongoStore);
console.log('MongoStore keys:', Object.keys(MongoStore));
console.log('MongoStore value:', MongoStore);
console.log('MongoStore.default:', MongoStore.default);
console.log('=== END DEBUG ===');