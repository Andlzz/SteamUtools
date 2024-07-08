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
            console.log("寄"+error)
        }
    }

    async readLoginUsersVdf() {
        const steamPath = await this.getSteamPath();
        const vdfPath = `${steamPath}\\config\\loginusers.vdf`;

        try {
            const fileContent = await fs.readFile(vdfPath, 'utf8');
            return fileContent;
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
            const vdfContent = await steamService.readLoginUsersVdf();
            console.log(vdfContent);
            return vdfContent;
        } catch (error) {
            console.error('Failed to read Steam login users VDF:', error);
        }
    }
};