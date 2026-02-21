CREATE DATABASE TestDB;
GO
USE TestDB;
GO

CREATE TABLE Logs (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    Message NVARCHAR(MAX),
    Severity NVARCHAR(50),
    Timestamp DATETIME DEFAULT GETDATE()
);

INSERT INTO Logs (Message, Severity) VALUES ('System initialized', 'INFO');
INSERT INTO Logs (Message, Severity) VALUES ('User logged in', 'DEBUG');
GO
