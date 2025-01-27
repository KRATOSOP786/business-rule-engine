const sql = require('mssql');

const config = {
    server: 'hackathondatabase.database.windows.net',
    database: 'hachathon',
    user: 'hackathon-admin',
    password: 'Pune@2024',
    port: 1433,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  };

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Connected to SQL Server');
        return pool;
    })
    .catch(err => console.log('Database Connection Failed! Bad Config: ', err));

module.exports = {sql, poolPromise};
