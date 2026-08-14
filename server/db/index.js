/**
 * 数据库辅助模块 - 提供统一的数据库访问方法
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/workbench.db');

// 加载数据
function loadData() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { projects: [], tasks: [], todos: [], members: [], documents: [], notifications: [] };
    }
}

// 保存数据
function saveData(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// 获取所有成员
function getMembers() {
    return loadData().members || [];
}

// 获取项目通过ID
function getProjectById(id) {
    const data = loadData();
    return data.projects?.find(p => p.id === id) || null;
}

// 获取成员通过ID
function getMemberById(id) {
    const members = getMembers();
    return members.find(m => m.id === id) || null;
}

// 获取成员通过邮箱
function getMemberByEmail(email) {
    const members = getMembers();
    return members.find(m => m.email === email) || null;
}

// 获取成员通过姓名
function getMemberByName(name) {
    const members = getMembers();
    return members.find(m => m.name === name) || null;
}

module.exports = {
    loadData,
    saveData,
    getMembers,
    getMemberById,
    getMemberByEmail,
    getMemberByName,
    getProjectById
};
