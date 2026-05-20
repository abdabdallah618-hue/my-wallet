const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.static(path.join(__dirname, 'public')));

function readData() {
    const defaultData = { 
        salary: 0, initialCard: 0, initialCash: 0, 
        cardBalance: 0, cashBalance: 0, 
        expenses: [], debts: [], lastSalaryMonth: "", isLocked: false 
    };

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    
    try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        let data = JSON.parse(fileContent);

        // تصفير تلقائي يوم 27
        const today = new Date();
        const currentMonthYear = `${today.getFullYear()}-${today.getMonth() + 1}`;
        
        if (today.getDate() >= 27 && data.lastSalaryMonth !== currentMonthYear && data.salary > 0) {
            data.salary = 0;
            data.initialCard = 0;
            data.initialCash = 0;
            data.cardBalance = 0;
            data.cashBalance = 0;
            data.expenses = []; 
            data.isLocked = false;
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        }

        return data;
    } catch (error) {
        return defaultData;
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

io.on('connection', (socket) => {
    let financialData = readData();
    socket.emit('updateData', financialData);

    socket.on('setSalary', (data) => {
        financialData.salary = parseFloat(data.salary) || 0;
        financialData.initialCard = parseFloat(data.card) || 0;
        financialData.initialCash = parseFloat(data.cash) || 0;
        
        financialData.cardBalance = financialData.initialCard;
        financialData.cashBalance = financialData.initialCash;
        financialData.lastSalaryMonth = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
        financialData.isLocked = true;
        
        saveData(financialData);
        io.emit('updateData', financialData);
    });

    socket.on('unlockSalary', () => {
        financialData.isLocked = false;
        saveData(financialData);
        io.emit('updateData', financialData);
    });

    socket.on('addExpense', (expense) => {
        const amount = parseFloat(expense.amount) || 0;
        const newExpense = {
            id: Date.now(),
            title: expense.title,
            amount: amount,
            category: expense.category, // 'need' أو 'want'
            method: expense.method,
            date: new Date().toLocaleDateString('ar-IQ', { hour: '2-digit', minute: '2-digit' })
        };

        financialData.expenses.unshift(newExpense);

        if (expense.method === 'cash') {
            financialData.cashBalance -= amount;
        } else {
            financialData.cardBalance -= amount;
        }

        saveData(financialData);
        io.emit('updateData', financialData);
    });

    socket.on('addDebt', (debt) => {
        financialData.debts.push({
            id: Date.now(),
            name: debt.name,
            amount: parseFloat(debt.amount) || 0,
            date: new Date().toLocaleDateString('ar-IQ')
        });
        saveData(financialData);
        io.emit('updateData', financialData);
    });

    socket.on('deleteItem', (data) => {
        if (data.type === 'expense') {
            const item = financialData.expenses.find(e => e.id === data.id);
            if (item) {
                if (item.method === 'cash') financialData.cashBalance += item.amount;
                else financialData.cardBalance += item.amount;
                financialData.expenses = financialData.expenses.filter(e => e.id !== data.id);
            }
        } else if (data.type === 'debt') {
            financialData.debts = financialData.debts.filter(d => d.id !== data.id);
        }
        saveData(financialData);
        io.emit('updateData', financialData);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بترقيات خرافية على: http://localhost:${PORT}`);
});