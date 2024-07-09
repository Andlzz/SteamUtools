const Registry = require('winreg'); // 导入winreg模块中的Registry构造函数
const fs = require('fs').promises;

class SteamService {
    constructor() {
        this.steamPath = '';
    }

    async getSteamPath() {
        try {
            const regKey = new Registry({
                hive: Registry.HKCU, // 使用Registry.HKCU常量
                key: '\\Software\\Valve\\Steam' // 注意路径字符串的书写
            });
            const result = await new Promise((resolve, reject) => {
                regKey.get('SteamPath', (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result.value);
                    }
                });
            });
            this.steamPath = result
            return this.steamPath;
        } catch (error) {
            console.log("寄" + error)
        }
    }

    async readLoginUsersVdf() {
        const steamPath = await this.getSteamPath();
        const vdfPath = `${steamPath}\\config\\loginusers.vdf`;

        try {
            const data = await fs.readFile(vdfPath, 'utf8');
            // 正则表达式匹配用户数据块
            const userBlockRegex = /"(\d+)"\s*{\s*((?:"\w+"\s+"[^"]+",?\s*)*)\s*}/g;
            const users = [];

            let match;
            while ((match = userBlockRegex.exec(data)) !== null) {
                // 存储用户ID和字段字符串
                const userId = match[1];
                const fieldsString = match[2];

                // 正则表达式匹配字段名和值
                const fieldRegex = /"(\w+)"\s+"(\w+)"/g;
                let fieldMatch;
                const currentUser = {};

                while ((fieldMatch = fieldRegex.exec(fieldsString)) !== null) {
                    const key = fieldMatch[1];
                    const value = fieldMatch[2];
                    currentUser[key] = value;
                }

                // 过滤RememberPassword为0的用户
                if (currentUser.RememberPassword !== '0') {
                    users.push({
                        id: userId,
                        ...currentUser
                    });
                }
            }
            console.log(users)
            return users;
        } catch (error) {
            console.error('Failed to read the loginusers.vdf file:', error);
            throw error;
        }
    }
}

// 请确保您的环境支持window.services，例如Electron或浏览器环境
if (typeof window !== 'undefined' && !window.services) {
    window.services = {};
}

window.services.steamService = {
    readLoginUsersVdf: async () => {
        const steamService = new SteamService();
        try {
            return await steamService.readLoginUsersVdf();
        } catch (error) {
            console.error('Failed to read Steam login users VDF:', error);
        }
    }
};